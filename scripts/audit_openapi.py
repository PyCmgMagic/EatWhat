"""Inspect the local API contract without calling a backend or exposing example data."""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone, timedelta
import hashlib
from importlib.metadata import version
import json
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from openapi_spec_validator import OpenAPIV31SpecValidator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012


METHODS = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}
DOCUMENT_URI = "urn:eatwhat:openapi"
CURRENT_CONTRACT = "吃什么接口文档v2-openapi.yaml"


def pointer(parts):
    return "/" + "/".join(str(p).replace("~", "~0").replace("/", "~1") for p in parts)


def walk(value, parts=()):
    if isinstance(value, dict):
        yield parts, value
        for key, child in value.items():
            yield from walk(child, (*parts, key))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk(child, (*parts, index))


def schema_name(schema):
    return schema.get("$ref", "").rsplit("/", 1)[-1] or schema.get("type", "unspecified")


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output", type=Path, default=root / "docs" / "API_AUDIT.json")
    args = parser.parse_args()
    source = args.input or root / CURRENT_CONTRACT
    raw = source.read_bytes()
    source_format = "yaml" if source.suffix.lower() in {".yaml", ".yml"} else "json"
    document = (yaml.safe_load if source_format == "yaml" else json.loads)(raw.decode("utf-8-sig"))
    operations = [
        (path, method, operation)
        for path, item in document["paths"].items()
        for method, operation in item.items()
        if method in METHODS
    ]

    broken_refs = []
    invalid_defaults = []
    ref_count = 0
    for parts, value in walk(document):
        ref = value.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/"):
            ref_count += 1
            target = document
            try:
                for segment in ref[2:].split("/"):
                    target = target[segment.replace("~1", "/").replace("~0", "~")]
            except (KeyError, TypeError):
                broken_refs.append({"pointer": pointer(parts), "ref": ref})
        if "default" in value and "enum" in value and value["default"] not in value["enum"]:
            invalid_defaults.append({"pointer": pointer(parts), "reason": "default_not_in_enum"})

    registry = Registry().with_resource(
        DOCUMENT_URI, Resource.from_contents(document, default_specification=DRAFT202012)
    )
    example_count = 0
    examples_with_errors = 0
    example_issues = []
    success_codes = Counter()
    inventory = []
    for path, method, operation in operations:
        op_parts = ("paths", path, method)
        groups = []
        if "requestBody" in operation:
            groups.append(("request", operation["requestBody"], (*op_parts, "requestBody")))
        groups.extend(
            (f"response:{status}", response, (*op_parts, "responses", status))
            for status, response in operation.get("responses", {}).items()
        )
        for kind, group, group_parts in groups:
            for media_type, media in group.get("content", {}).items():
                schema_pointer = pointer((*group_parts, "content", media_type, "schema"))
                validator = Draft202012Validator(
                    {"$ref": DOCUMENT_URI + "#" + schema_pointer}, registry=registry
                )
                examples = [(str(k), v["value"]) for k, v in media.get("examples", {}).items()
                            if isinstance(v, dict) and "value" in v]
                if "example" in media:
                    examples.append(("example", media["example"]))
                for name, example in examples:
                    example_count += 1
                    if isinstance(example, dict) and "code" in example:
                        success_codes[str(example["code"])] += 1
                    errors = list(validator.iter_errors(example))
                    examples_with_errors += bool(errors)
                    for error in errors:
                        # Keep locations and types, never sample field values or personal data.
                        example_issues.append({
                            "operation": f"{method.upper()} {path}",
                            "kind": kind,
                            "example": name,
                            "instance_pointer": pointer(error.path),
                            "validator": error.validator,
                            "expected_type": error.schema.get("type") if isinstance(error.schema, dict) else None,
                            "actual_type": type(error.instance).__name__,
                        })

        inventory.append({
            "path": path,
            "method": method.upper(),
            "summary": operation.get("summary", ""),
            "operation_id": operation.get("operationId"),
            "tags": operation.get("tags", []),
            "description": operation.get("description", ""),
            "security": operation.get("security", document.get("security", [])),
            "required_roles": operation.get("x-required-roles", []),
            "conditional_properties": operation.get("x-conditional-properties"),
            "java_handler": operation.get("x-java-handler"),
            "parameters": operation.get("parameters", []),
            "request_body_required": operation.get("requestBody", {}).get("required", False),
            "request_schemas": {
                media_type: schema_name(media.get("schema", {}))
                for media_type, media in operation.get("requestBody", {}).get("content", {}).items()
            },
            "response_schemas": {
                status: {media_type: schema_name(media.get("schema", {}))
                         for media_type, media in response.get("content", {}).items()}
                for status, response in operation.get("responses", {}).items()
            },
        })

    spec_errors = list(OpenAPIV31SpecValidator(document).iter_errors())
    report = {
        "generated_at": datetime.now(timezone(timedelta(hours=8))).isoformat(),
        "source_file": source.name,
        "source_format": source_format,
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "source_info": document.get("info", {}),
        "source_metadata": {key: value for key, value in document.items() if key.startswith("x-")},
        "scope": "Static contract review; no backend requests or implementation verification.",
        "tools": {name: version(name) for name in
                  ("openapi-spec-validator", "jsonschema", "referencing", "PyYAML")},
        "counts": {
            "paths": len(document["paths"]),
            "operations": len(operations),
            "schemas": len(document["components"]["schemas"]),
            "operations_by_group": dict(Counter(path.split("/")[1] for path, _, _ in operations)),
            "empty_operation_tags": sum(not op.get("tags") for _, _, op in operations),
            "missing_operation_id": sum(not op.get("operationId") for _, _, op in operations),
            "duplicate_operation_ids": [name for name, count in Counter(
                op["operationId"] for _, _, op in operations if op.get("operationId")
            ).items() if count > 1],
            "empty_operation_description": sum(not op.get("description") for _, _, op in operations),
            "operations_with_only_200_documented": sum(set(op.get("responses", {})) == {"200"}
                                                      for _, _, op in operations),
            "request_bodies": sum("requestBody" in op for _, _, op in operations),
            "request_bodies_marked_required": sum(op.get("requestBody", {}).get("required", False)
                                                 for _, _, op in operations),
            "operations_with_default_error_response": sum("default" in op.get("responses", {})
                                                          for _, _, op in operations),
            "conditional_operations": sum("x-conditional-properties" in op for _, _, op in operations),
            "operations_by_required_role": dict(Counter(
                ",".join(op.get("x-required-roles", [])) or "no_extra_role_declared"
                for _, _, op in operations
            )),
            "operations_by_authentication": dict(Counter(
                "session" if op.get("security", document.get("security", [])) else "no_session_declared"
                for _, _, op in operations
            )),
            "local_refs": ref_count,
            "broken_local_refs": len(broken_refs),
            "openapi_validator_errors": len(spec_errors),
            "examples_checked": example_count,
            "examples_with_errors": examples_with_errors,
            "example_validation_issues": len(example_issues),
        },
        "servers": document.get("servers", []),
        "security_schemes": document.get("components", {}).get("securitySchemes", {}),
        "example_validation_scope": "Media-type example and examples.*.value only; zero means no examples to validate, not runtime success.",
        "business_codes_in_examples": dict(success_codes),
        "broken_refs": broken_refs,
        "defaults_outside_enum": invalid_defaults,
        "openapi_validator_errors": [{
            "instance_pointer": pointer(error.path),
            "schema_pointer": pointer(error.schema_path),
            "validator": getattr(error, "validator", None),
        } for error in spec_errors],
        "example_validation_issues": example_issues,
        "operations": inventory,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    inventory_path = args.output.parent / "API_INVENTORY.md"
    lines = ["# 接口清单（当前契约）", "",
             f"唯一分析来源：`{source.name}`，版本 `{document.get('info', {}).get('version', '')}`。", "",
             f"共 {len(operations)} 个操作、{len(document['paths'])} 个路径；旧版导出不参与本清单。", "",
             "鉴权与角色列反映文档声明，未进行运行验证。`*` 表示参数必填；请求体是否必填单独列出。", "",
             "请求头以登录返回的 tokenName 为准；当前为 `satoken: Bearer <tokenValue>`。", "",
             "网关路径按 `/api` + 后端原始路径拼接：`/api/location/...` 经网关为 `/api/api/location/...`，不自动去重。", ""]
    for group in dict.fromkeys(row["path"].split("/")[1] for row in inventory):
        lines.extend([f"## /{group}", "",
                      "| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |",
                      "| --- | --- | --- | --- | --- | --- | --- |"])
        for row in inventory:
            if row["path"].split("/")[1] != group:
                continue
            parameters = "; ".join(
                f"{p['in']}:{p['name']}{'*' if p.get('required') else ''}"
                for p in row["parameters"]
            ) or "—"
            body = ", ".join(row["request_schemas"].values())
            body = f"{body} / {'是' if row['request_body_required'] else '否'}" if body else "—"
            response = "; ".join(f"{status}: {', '.join(schemas.values())}"
                                 for status, schemas in row["response_schemas"].items())
            schemes = document.get("components", {}).get("securitySchemes", {})
            auth_names = list(dict.fromkeys(name for alternative in row["security"] for name in alternative))
            auth = ", ".join(
                f"{name}（{schemes[name]['name']} 请求头）"
                if schemes.get(name, {}).get("type") == "apiKey" else name
                for name in auth_names
            ) or "无会话要求声明"
            if row["required_roles"]:
                auth += " + " + ", ".join(row["required_roles"])
            condition = row["conditional_properties"]
            condition_text = (", ".join(condition.get("name", [])) + "=" + str(condition.get("havingValue", ""))) if condition else "—"
            summary = row["summary"].replace("|", "\\|").replace("\n", " ")
            lines.append(f"| `{row['method']} {row['path']}` | {summary} | {auth} | {condition_text} | {parameters} | {body} | {response} |")
        lines.append("")
    inventory_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"audit": str(args.output), "inventory": str(inventory_path),
                      "counts": report["counts"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
