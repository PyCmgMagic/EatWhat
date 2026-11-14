#!/usr/bin/env python3
"""Build, transfer and atomically activate EatWhat's static frontend (stdlib only)."""

import argparse
import contextlib
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import shutil
import signal
import subprocess
import tarfile
import tempfile
import time
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

HOST = "64.178.99.89"
DEFAULT_BASE = "/www/wwwroot/eatwhat-frontend"
DEFAULT_PUBLIC = "https://eat.v50to.you"
DEFAULT_API = "https://eat.v50to.you/api/recommend/tags"
MARKER = "deployment.json"
RELEASE = re.compile(r"[0-9a-f]{40}-[0-9]+-[0-9]+\Z")
MAX_BYTES = 512 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, ensure_ascii=False) + "\n").encode()


def safe_path(name):
    parts = PurePosixPath(name).parts
    require(parts and not name.startswith("/") and ".." not in parts, "Unsafe archive path")
    require(str(PurePosixPath(name)) == name and "\\" not in name, "Noncanonical archive path")
    require(not any(p.startswith(".env") or p == ".git" for p in parts), "Private file in bundle")
    return name


def pack(dist, output, sha, run_id, attempt, sequence):
    require(re.fullmatch(r"[0-9a-f]{40}", sha), "Invalid source SHA")
    require(min(run_id, attempt, sequence) > 0, "Invalid workflow identity")
    release = f"{sha}-{run_id}-{attempt}"
    files = {}
    for path in sorted(dist.rglob("*")):
        require(not path.is_symlink(), "Symlink in build output")
        if path.is_file():
            name = safe_path(path.relative_to(dist).as_posix())
            require(name != MARKER, "Reserved deployment marker in build output")
            files[name] = path.read_bytes()
    require(files.get("index.html"), "Build output has no index.html")
    require(any(n.startswith("assets/") and n.endswith(".js") for n in files), "Missing JS assets")
    metadata = {"release": release, "sourceSha": sha, "sequence": sequence}
    files[MARKER] = json_bytes(metadata)
    require(sum(map(len, files.values())) <= MAX_BYTES, "Build output too large")
    manifest = {"schema": 1, **metadata, "files": {n: digest(b) for n, b in files.items()}}
    output.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output, "w:gz") as archive:
        for name, data in [("manifest.json", json_bytes(manifest)), *[("site/" + n, b) for n, b in files.items()]]:
            entry = tarfile.TarInfo(name)
            entry.size, entry.mode = len(data), 0o644
            archive.addfile(entry, io.BytesIO(data))
    output.with_suffix(output.suffix + ".sha256").write_text(digest(output.read_bytes()) + "\n")
    return release


def unpack(bundle, expected_digest, destination):
    require(re.fullmatch(r"[0-9a-f]{64}", expected_digest), "Invalid bundle digest")
    require(digest(bundle.read_bytes()) == expected_digest, "Bundle digest mismatch")
    with tarfile.open(bundle, "r:gz") as archive:
        members = archive.getmembers()
        names = [m.name for m in members]
        require(len(names) <= 30000 and len(names) == len(set(names)), "Duplicate or excessive archive entries")
        require(sum(m.size for m in members) <= MAX_BYTES, "Archive too large")
        require(all(m.isfile() for m in members), "Only regular files are allowed")
        require("manifest.json" in names, "Missing manifest")
        manifest = json.load(archive.extractfile("manifest.json"))
        require(manifest.get("schema") == 1 and RELEASE.fullmatch(manifest.get("release", "")), "Invalid manifest")
        require(type(manifest.get("sequence")) is int and manifest["sequence"] > 0, "Invalid build sequence")
        require(manifest["sourceSha"] == manifest["release"].split("-")[0], "Source identity mismatch")
        files = manifest["files"]
        require("index.html" in files and MARKER in files, "Incomplete manifest")
        require(set(names) == {"manifest.json", *("site/" + safe_path(n) for n in files)}, "Archive inventory mismatch")
        for name, expected in files.items():
            data = archive.extractfile("site/" + name).read()
            require(digest(data) == expected, "File digest mismatch")
            path = destination / name
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("xb") as stream:
                stream.write(data)
            path.chmod(0o644)
        marker = json.loads((destination / MARKER).read_bytes())
        require(all(marker.get(k) == manifest[k] for k in ("release", "sourceSha", "sequence")), "Marker identity mismatch")
        for directory in destination.rglob("*"):
            if directory.is_dir():
                directory.chmod(0o755)
        return manifest


def https_url(value, allow_query=False):
    url = urlsplit(value)
    require(url.scheme == "https" and url.hostname and not url.username and not url.password,
            "A public HTTPS URL without credentials is required")
    require(not url.fragment and (allow_query or not url.query), "Invalid public URL")
    return value.rstrip("/")


def fetch(url):
    request = Request(url, headers={"Cache-Control": "no-cache", "Accept-Encoding": "identity"})
    with urlopen(request, timeout=15) as response:
        require(urlsplit(response.url).scheme == "https", "HTTPS downgrade")
        data = response.read(MAX_BYTES + 1)
        require(len(data) <= MAX_BYTES, "Oversized HTTP response")
        return data


def check_api(url):
    response = json.loads(fetch(url))
    require(isinstance(response, dict) and response.get("code") == 0, "API smoke check failed")
    data = response.get("data")
    require(
        isinstance(data, dict)
        and all(isinstance(data.get(key), list) and all(isinstance(item, str) for item in data[key])
                for key in ("categories", "tags", "dislikableTags")),
        "API smoke check expected the backend v2 recommendation tags",
    )


def check_site(public, target):
    nonce = str(time.time_ns())
    index = fetch(public + "/index.html?deployment=" + nonce)
    require(digest(index) == digest((target / "index.html").read_bytes()), "Public index does not match release")
    marker = target / MARKER
    if marker.exists():
        actual = json.loads(fetch(public + "/" + MARKER + "?deployment=" + nonce))
        require(actual == json.loads(marker.read_bytes()), "Public deployment identity mismatch")
    # Select the entrypoint from HTML, rather than testing an arbitrary unused chunk.
    html = index.decode()
    scripts = re.findall(r'<script\b[^>]*\bsrc=["\'](/assets/[^"\']+\.js)["\']', html)
    require(scripts, "No JS entrypoint in index.html")
    for script in scripts:
        name = safe_path(script.lstrip("/"))
        require(digest(fetch(public + quote(script) + "?deployment=" + nonce)) == digest((target / name).read_bytes()),
                "Public entrypoint does not match release")


def switch(base, target):
    temporary = base / f".current-{os.getpid()}"
    try:
        temporary.symlink_to(target.relative_to(base), target_is_directory=True)
        os.replace(temporary, base / "current")
    finally:
        temporary.unlink(missing_ok=True)


def current_target(base):
    current = base / "current"
    require(current.is_symlink(), "Initialize current as a symlink before deploying")
    target = current.resolve(strict=True)
    require(target.parent == (base / "releases").resolve(strict=True), "Current release is outside releases directory")
    require((target / "index.html").is_file(), "Current release is incomplete")
    return target


def build_assets(release):
    manifest = release / ".vite/manifest.json"
    if manifest.is_file():
        names = set()
        for chunk in json.loads(manifest.read_bytes()).values():
            names.update([chunk["file"], *chunk.get("css", []), *chunk.get("assets", [])])
    else:
        # A manually initialized bootstrap may have just an HTML entrypoint.
        index = release / "index.html"
        names = set(re.findall(r'(?:src|href)=["\']/([^"\']+)["\']', index.read_text())) if index.is_file() else set()
    retained = release / ".vite/retained-assets.json"
    if retained.is_file():
        names.update(json.loads(retained.read_bytes()))
    return {n for n in names if n.startswith("assets/") and re.search(r"-[A-Za-z0-9_-]{8}\.[^/]+$", n)}


def retain_assets(previous, candidate):
    # Already-open pages can still lazy-load chunks from earlier releases.
    generated = build_assets(previous)
    if previous.parent.name == "releases" and not (previous / ".vite/retained-assets.json").exists():
        # Older deployers copied chunks forward without recording their origin.
        # Recover only names attested by an existing release's build manifest.
        for release in previous.parent.iterdir():
            if not release.is_symlink() and (release / ".vite/manifest.json").is_file():
                generated.update(build_assets(release))
    carried = set()
    for path in (previous / "assets").rglob("*"):
        require(not path.is_symlink(), "Symlink in previous assets")
        name = path.relative_to(previous).as_posix()
        if path.is_file() and name in generated:
            target = candidate / name
            if target.exists():
                require(digest(target.read_bytes()) == digest(path.read_bytes()), "Asset filename collision")
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, target)
                target.chmod(0o644)
                carried.add(name)
    metadata = candidate / ".vite/retained-assets.json"
    metadata.parent.mkdir(exist_ok=True)
    if metadata.exists():  # A rollback target may already carry older chunks.
        carried.update(json.loads(metadata.read_bytes()))
    metadata.write_bytes(json_bytes(sorted(carried)))
    for directory in (candidate / "assets").rglob("*"):
        if directory.is_dir():
            directory.chmod(0o755)


def interrupted(signum, frame):
    raise RuntimeError("Deployment interrupted")


@contextlib.contextmanager
def deployment_lock(base):
    require(base.is_dir() and not base.is_symlink(), "Deployment base must be a real initialized directory")
    require((base / "releases").is_dir() and not (base / "releases").is_symlink(), "Releases must be a real directory")
    with (base / ".deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        handlers = {s: signal.signal(s, interrupted) for s in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)}
        try:
            yield
        finally:
            for signum, handler in handlers.items():
                signal.signal(signum, handler)


def activate(base, target, previous, public, api):
    switched = False
    try:
        switched = True
        switch(base, target)
        for attempt in range(5):
            try:
                check_site(public, target)
                check_api(api)
                return
            except (ValueError, OSError) as error:
                if attempt == 4:
                    raise RuntimeError("Public verification failed") from error
                time.sleep(3)
    except BaseException:
        if switched:
            switch(base, previous)
            print("Restored the previous release symlink", flush=True)
            try:
                check_site(public, previous)
            except Exception:
                print("Previous symlink restored; public rollback verification failed", flush=True)
        raise


def apply(base, bundle, expected_digest, public, api):
    public, api = https_url(public), https_url(api, allow_query=True)
    with deployment_lock(base):
        base = base.resolve(strict=True)
        previous = current_target(base)
        check_api(api)  # Fail without switching if the existing API is unavailable.
        with tempfile.TemporaryDirectory(prefix=".prepare-", dir=base / "releases") as temporary:
            candidate = Path(temporary)
            manifest = unpack(bundle, expected_digest, candidate)
            state = base / "deployment-state.json"
            old_marker = state if state.exists() else previous / MARKER
            if old_marker.exists():
                old = json.loads(old_marker.read_bytes())
                require(manifest["sequence"] >= old["sequence"], "Refusing a stale workflow deployment")
                require(manifest["sequence"] != old["sequence"] or manifest["sourceSha"] == old["sourceSha"],
                        "Conflicting build sequence")
            retain_assets(previous, candidate)
            target = base / "releases" / manifest["release"]
            require(not target.exists(), "Release already exists; rerun the workflow for a new attempt")
            candidate.chmod(0o755)
            candidate.rename(target)
            # Keep the highest accepted build sequence even after a rollback.
            temporary_state = base / ".deployment-state.next"
            temporary_state.write_bytes(json_bytes({k: manifest[k] for k in ("sequence", "sourceSha")}))
            os.replace(temporary_state, state)
            shutil.copyfile(__file__, base / "frontend_deploy.py")
            # TemporaryDirectory cleanup tolerates the moved directory.
            activate(base, target, previous, public, api)
        print("Activated release " + manifest["release"])


def rollback(base, release, public, api):
    public, api = https_url(public), https_url(api, allow_query=True)
    require(release == "bootstrap" or RELEASE.fullmatch(release), "Invalid rollback release")
    with deployment_lock(base):
        base = base.resolve(strict=True)
        previous = current_target(base)
        target = (base / "releases" / release).resolve(strict=True)
        require(target.parent == (base / "releases").resolve(strict=True), "Invalid rollback target")
        require((target / "index.html").is_file(), "Rollback target is incomplete")
        # Preserve the newest chunks when activating an older index, too.
        retain_assets(previous, target)
        activate(base, target, previous, public, api)
        print("Rolled back to " + release)


def ship(bundle):
    user = os.environ["FRONTEND_SSH_USER"]
    port = os.environ.get("FRONTEND_SSH_PORT", "22")
    base = os.environ.get("FRONTEND_DEPLOY_PATH", DEFAULT_BASE)
    require(re.fullmatch(r"[a-z_][a-z0-9_-]*", user) and user != "root", "Use a dedicated non-root deploy user")
    require(port.isdigit() and 0 < int(port) < 65536, "Invalid SSH port")
    require(re.fullmatch(r"/[A-Za-z0-9_/-]+", base) and ".." not in base and base.count("/") >= 3,
            "Invalid deployment base")
    public = https_url(os.environ.get("FRONTEND_PUBLIC_URL", DEFAULT_PUBLIC))
    api = https_url(os.environ.get("FRONTEND_API_SMOKE_URL", DEFAULT_API), allow_query=True)
    expected = bundle.with_suffix(bundle.suffix + ".sha256").read_text().strip()
    require(digest(bundle.read_bytes()) == expected, "Downloaded artifact digest mismatch")
    with tarfile.open(bundle, "r:gz") as archive:
        release = json.load(archive.extractfile("manifest.json"))["release"]
    require(RELEASE.fullmatch(release), "Invalid release identity")
    remote = f"{base}/incoming/{release}"
    target = f"{user}@{HOST}"
    with tempfile.TemporaryDirectory(prefix="eatwhat-ssh-") as temporary:
        directory = Path(temporary)
        directory.chmod(0o700)
        key, known = directory / "key", directory / "known_hosts"
        key.write_text(os.environ["FRONTEND_SSH_PRIVATE_KEY"].rstrip() + "\n")
        known.write_text(os.environ["FRONTEND_SSH_KNOWN_HOSTS"].rstrip() + "\n")
        key.chmod(0o600)
        options = ["-i", str(key), "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o",
                   "StrictHostKeyChecking=yes", "-o", f"UserKnownHostsFile={known}", "-o", "ConnectTimeout=15"]
        def ssh(arguments):
            subprocess.run(["ssh", *options, "-p", port, target, shlex.join(arguments)], check=True)
        ssh(["mkdir", "-p", "--", remote])
        subprocess.run(["scp", *options, "-P", port, str(bundle), str(Path(__file__).resolve()),
                        f"{target}:{remote}/"], check=True)
        ssh(["python3", remote + "/frontend_deploy.py", "apply", "--base", base,
             "--bundle", remote + "/" + bundle.name, "--sha256", expected,
             "--public-url", public, "--api-smoke-url", api])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    package = commands.add_parser("pack")
    package.add_argument("--dist", type=Path, required=True)
    package.add_argument("--output", type=Path, required=True)
    package.add_argument("--sha", required=True)
    for name in ("run-id", "attempt", "sequence"):
        package.add_argument("--" + name, type=int, required=True)
    transfer = commands.add_parser("ship")
    transfer.add_argument("--bundle", type=Path, required=True)
    for name in ("apply", "rollback"):
        command = commands.add_parser(name)
        command.add_argument("--base", type=Path, default=Path(DEFAULT_BASE))
        command.add_argument("--public-url", default=DEFAULT_PUBLIC)
        command.add_argument("--api-smoke-url", default=DEFAULT_API)
        if name == "apply":
            command.add_argument("--bundle", type=Path, required=True)
            command.add_argument("--sha256", required=True)
        else:
            command.add_argument("--release", required=True)
    args = parser.parse_args()
    if args.command == "pack":
        print(pack(args.dist, args.output, args.sha, args.run_id, args.attempt, args.sequence))
    elif args.command == "ship":
        ship(args.bundle)
    elif args.command == "apply":
        apply(args.base, args.bundle, args.sha256, args.public_url, args.api_smoke_url)
    else:
        rollback(args.base, args.release, args.public_url, args.api_smoke_url)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError) as error:
        raise SystemExit("Frontend deployment failed: " + str(error))
    except Exception as error:
        # Do not print HTTP bodies, credential-bearing environment values or SSH keys.
        raise SystemExit("Frontend deployment failed (" + type(error).__name__ + "); inspect the failed step and server state.")
