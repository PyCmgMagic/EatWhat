import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("deploy", Path(__file__).parents[1] / "frontend_deploy.py")
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class ApiSmokeTest(unittest.TestCase):
    def test_requires_backend_v2_recommendation_tags(self):
        good = {"code": 0, "data": {"categories": ["粉面"], "tags": ["辣"], "dislikableTags": ["辣"]}}
        for payload in ({"code": 0, "data": {"items": []}}, {"code": 0, "data": {**good["data"], "tags": [1]}}):
            with patch.object(deploy, "fetch", return_value=json.dumps(payload).encode()):
                with self.assertRaisesRegex(ValueError, "backend v2 recommendation tags"):
                    deploy.check_api(deploy.DEFAULT_API)
        with patch.object(deploy, "fetch", return_value=json.dumps(good).encode()):
            deploy.check_api(deploy.DEFAULT_API)


class DeploymentTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.base = self.root / "server"
        self.old = self.base / "releases/bootstrap"
        (self.old / "assets").mkdir(parents=True)
        (self.old / "assets/old-abcdefgh.js").write_text("old chunk")
        (self.old / "index.html").write_text('<script src="/assets/old-abcdefgh.js"></script>')
        (self.base / "current").symlink_to("releases/bootstrap")
        self.dist = self.root / "dist"
        (self.dist / "assets").mkdir(parents=True)
        (self.dist / "assets/new-ijklmnop.js").write_text("new chunk")
        (self.dist / "index.html").write_text('<script type="module" src="/assets/new-ijklmnop.js"></script>')
        self.bundle = self.root / "site.tar.gz"
        self.sha = "a" * 40
        self.release = deploy.pack(self.dist, self.bundle, self.sha, 100, 1, 2)
        self.checksum = hashlib.sha256(self.bundle.read_bytes()).hexdigest()

    def apply(self):
        deploy.apply(self.base, self.bundle, self.checksum, "https://frontend.invalid", "https://api.invalid")

    def test_activates_verified_bundle_and_retains_old_lazy_chunks(self):
        with patch.object(deploy, "check_api"), patch.object(deploy, "check_site"):
            self.apply()
        target = (self.base / "current").resolve()
        self.assertEqual(target.name, self.release)
        self.assertEqual((target / "assets/old-abcdefgh.js").read_text(), "old chunk")
        self.assertEqual((target / "assets/new-ijklmnop.js").read_text(), "new chunk")
        self.assertEqual(json.loads((target / "deployment.json").read_text())["sourceSha"], self.sha)

    def test_bad_bundle_digest_does_not_switch(self):
        self.checksum = "0" * 64
        with patch.object(deploy, "check_api"), self.assertRaisesRegex(ValueError, "digest mismatch"):
            self.apply()
        self.assertEqual((self.base / "current").resolve(), self.old)

    def test_api_failure_does_not_switch(self):
        with patch.object(deploy, "check_api", side_effect=ValueError("API down")), self.assertRaises(ValueError):
            self.apply()
        self.assertEqual((self.base / "current").resolve(), self.old)

    def test_public_failure_restores_previous_release(self):
        def check(public, target):
            if target != self.old:
                raise ValueError("Wrong index")
        with patch.object(deploy, "check_api"), patch.object(deploy, "check_site", side_effect=check), \
                patch.object(deploy.time, "sleep"), self.assertRaises(RuntimeError):
            self.apply()
        self.assertEqual((self.base / "current").resolve(), self.old)

    def test_interrupted_deployment_restores_previous_release(self):
        with patch.object(deploy, "check_api"), patch.object(deploy, "check_site", side_effect=KeyboardInterrupt), \
                self.assertRaises(KeyboardInterrupt):
            self.apply()
        self.assertEqual((self.base / "current").resolve(), self.old)

    def test_older_workflow_cannot_replace_newer_release(self):
        (self.old / "deployment.json").write_text(json.dumps({"sequence": 3, "sourceSha": "b" * 40}))
        with patch.object(deploy, "check_api"), self.assertRaisesRegex(ValueError, "stale"):
            self.apply()
        self.assertEqual((self.base / "current").resolve(), self.old)

    def test_asset_name_collision_keeps_current_release(self):
        (self.old / "assets/new-ijklmnop.js").write_text("different bytes")
        (self.old / ".vite").mkdir()
        (self.old / ".vite/manifest.json").write_text(json.dumps({"a": {"file": "assets/new-ijklmnop.js"}}))
        with patch.object(deploy, "check_api"), self.assertRaisesRegex(ValueError, "collision"):
            self.apply()
        self.assertEqual((self.base / "current").resolve(), self.old)

    def test_mutable_public_asset_keeps_verified_candidate_bytes(self):
        for old_bytes, new_bytes in (
            (b'{"source":"same"}\r\n', b'{"source":"same"}\n'),
            (b'{"source":"old"}\n', b'{"source":"new"}\n'),
        ):
            with self.subTest(old_bytes=old_bytes):
                candidate = self.root / ('candidate-' + str(len(old_bytes)))
                candidate.mkdir(exist_ok=True)
                (candidate / 'assets').mkdir(exist_ok=True)
                (self.old / 'assets/sources.json').write_bytes(old_bytes)
                (candidate / 'assets/sources.json').write_bytes(new_bytes)
                deploy.retain_assets(self.old, candidate)
                self.assertEqual((candidate / 'assets/sources.json').read_bytes(), new_bytes)
                self.assertEqual((candidate / 'assets/old-abcdefgh.js').read_text(), 'old chunk')

    def test_only_known_build_assets_survive_multiple_releases(self):
        (self.old / "assets/withdrawn.png").write_bytes(b"withdrawn")
        (self.old / "assets/withdrawn-abcdefgh.png").write_bytes(b"withdrawn")
        for name in ("second", "third"):
            candidate = self.root / name
            candidate.mkdir()
            deploy.retain_assets(self.old, candidate)
            self.assertEqual((candidate / "assets/old-abcdefgh.js").read_text(), "old chunk")
            self.assertFalse((candidate / "assets/withdrawn.png").exists())
            self.assertFalse((candidate / "assets/withdrawn-abcdefgh.png").exists())
            self.old = candidate

    def malicious_bundle(self, name, kind=None):
        with tarfile.open(self.bundle, "w:gz") as archive:
            for path, data in [("manifest.json", b'{}'), (name, b'bad')]:
                info = tarfile.TarInfo(path)
                info.size = len(data)
                if kind and path == name:
                    info.type, info.linkname, info.size = kind, "/etc/passwd", 0
                archive.addfile(info, io.BytesIO(data))
        self.checksum = deploy.digest(self.bundle.read_bytes())

    def test_archive_link_rejected_before_extraction(self):
        self.malicious_bundle("site/link", tarfile.SYMTYPE)
        with patch.object(deploy, "check_api"), self.assertRaisesRegex(ValueError, "regular files"):
            self.apply()
        self.assertEqual((self.base / "current").resolve(), self.old)

    def test_path_traversal_rejected(self):
        with self.assertRaises(ValueError):
            deploy.safe_path("../outside")
        with self.assertRaises(ValueError):
            deploy.safe_path("/absolute")
        with self.assertRaises(ValueError):
            deploy.safe_path("assets/../../outside")
        with self.assertRaises(ValueError):
            deploy.safe_path(".env.production")

    def test_pack_rejects_symlinks(self):
        (self.dist / "leak").symlink_to(self.old / "index.html")
        with self.assertRaisesRegex(ValueError, "Symlink"):
            deploy.pack(self.dist, self.bundle, self.sha, 100, 1, 2)

    def test_http_smoke_checks_compare_public_bytes_and_identity(self):
        candidate = self.root / "unpacked"
        candidate.mkdir()
        deploy.unpack(self.bundle, self.checksum, candidate)
        def fetch(url):
            path = url.split("?", 1)[0].removeprefix("https://frontend.invalid/")
            return (candidate / path).read_bytes()
        with patch.object(deploy, "fetch", side_effect=fetch):
            deploy.check_site("https://frontend.invalid", candidate)
        with patch.object(deploy, "fetch", return_value=b"wrong frontend"):
            with self.assertRaisesRegex(ValueError, "index"):
                deploy.check_site("https://frontend.invalid", candidate)

    def test_manual_rollback_retains_newer_chunks(self):
        with patch.object(deploy, "check_api"), patch.object(deploy, "check_site"):
            self.apply()
            deploy.rollback(self.base, "bootstrap", "https://frontend.invalid", "https://api.invalid")
        self.assertEqual((self.base / "current").resolve(), self.old)
        self.assertEqual((self.old / "assets/new-ijklmnop.js").read_text(), "new chunk")

    def test_rollback_does_not_lower_stale_build_fence(self):
        with patch.object(deploy, "check_api"), patch.object(deploy, "check_site"):
            self.apply()
            deploy.rollback(self.base, "bootstrap", "https://frontend.invalid", "https://api.invalid")
        deploy.pack(self.dist, self.bundle, self.sha, 99, 1, 1)
        self.checksum = deploy.digest(self.bundle.read_bytes())
        with patch.object(deploy, "check_api"), self.assertRaisesRegex(ValueError, "stale"):
            self.apply()
        self.assertEqual((self.base / "current").resolve(), self.old)

    def test_failed_manual_rollback_restores_current_release(self):
        with patch.object(deploy, "check_api"), patch.object(deploy, "check_site"):
            self.apply()
        newest = (self.base / "current").resolve()
        def check(public, target):
            if target == self.old:
                raise ValueError("Rollback unavailable publicly")
        with patch.object(deploy, "check_api"), patch.object(deploy, "check_site", side_effect=check), \
                patch.object(deploy.time, "sleep"), self.assertRaises(RuntimeError):
            deploy.rollback(self.base, "bootstrap", "https://frontend.invalid", "https://api.invalid")
        self.assertEqual((self.base / "current").resolve(), newest)

    def test_inventory_tampering_rejected_even_with_matching_archive_checksum(self):
        with tarfile.open(self.bundle, "r:gz") as archive:
            entries = [(m.name, archive.extractfile(m).read()) for m in archive.getmembers()]
        with tarfile.open(self.bundle, "w:gz") as archive:
            for name, data in entries:
                if name == "site/index.html":
                    data = b"tampered"
                info = tarfile.TarInfo(name)
                info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
        self.checksum = deploy.digest(self.bundle.read_bytes())
        with patch.object(deploy, "check_api"), self.assertRaisesRegex(ValueError, "File digest"):
            self.apply()
        self.assertEqual((self.base / "current").resolve(), self.old)

    def test_linked_releases_directory_rejected(self):
        actual = self.base / "actual-releases"
        (self.base / "releases").rename(actual)
        (self.base / "releases").symlink_to(actual)
        with self.assertRaisesRegex(ValueError, "real directory"):
            self.apply()

    def test_ssh_transfer_pins_host_and_keeps_url_out_of_shell_syntax(self):
        environment = {
            "FRONTEND_SSH_USER": "eatwhat-web", "FRONTEND_SSH_PORT": "2222",
            "FRONTEND_SSH_PRIVATE_KEY": "fake test key", "FRONTEND_SSH_KNOWN_HOSTS": "fake test host",
            "FRONTEND_DEPLOY_PATH": str(self.base),
            "FRONTEND_API_SMOKE_URL": "https://api.invalid/recommend/tags",
        }
        with patch.dict(os.environ, environment, clear=True), patch.object(deploy.subprocess, "run") as run:
            deploy.ship(self.bundle)
        calls = [c.args[0] for c in run.call_args_list]
        self.assertEqual(len(calls), 3)
        self.assertTrue(all("StrictHostKeyChecking=yes" in c for c in calls))
        self.assertTrue(all(any(deploy.HOST in arg for arg in c) for c in calls))
        remote = deploy.shlex.split(calls[-1][-1])
        self.assertIn(environment["FRONTEND_API_SMOKE_URL"], remote)
        self.assertNotIn("fake test key", str(calls))

    def test_non_https_public_urls_rejected(self):
        for url in ("http://example.invalid", "https://user:password@example.invalid", "https://example.invalid/#a"):
            with self.assertRaises(ValueError):
                deploy.https_url(url)


if __name__ == "__main__":
    unittest.main()
