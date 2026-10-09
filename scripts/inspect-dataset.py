#!/usr/bin/env python3
"""Inspect the supplied reference ZIP without importing records or running its code."""

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from zipfile import BadZipFile, ZipFile


def inspect(archive):
    checks = []

    def check(name, condition):
        checks.append({"name": name, "result": "PASS" if condition else "FAIL"})

    with ZipFile(archive) as z:
        names = z.namelist()
        manifests = [name for name in names if name.endswith("/manifest.json")]
        if len(manifests) != 1:
            raise ValueError("Expected one root manifest.json")
        root = manifests[0].removesuffix("manifest.json")

        def read(name):
            return json.loads(z.read(root + name).decode("utf-8"))

        def rows(name):
            return [json.loads(line) for line in z.read(root + name).decode("utf-8").splitlines() if line.strip()]

        manifest = read("manifest.json")
        master = read("canonical/master_dataset.json")
        check("zip_crc", z.testzip() is None)
        check("unique_archive_paths", len(names) == len(set(names)))
        json_count = jsonl_count = 0
        for name in names:
            if name.endswith(".json"):
                json.loads(z.read(name).decode("utf-8"))
                json_count += 1
            elif name.endswith(".jsonl"):
                for line in z.read(name).decode("utf-8").splitlines():
                    if line.strip():
                        json.loads(line)
                jsonl_count += 1
        check("all_json_and_jsonl_parse", True)
        check("master_bundle_equal", master == read("baton_seed_bundle_v2.json"))
        check("dataset_version", master["dataset_version"] == manifest["dataset_version"] == "2.1.0")
        check("synthetic_patient_declaration", master["synthetic_patient_only"] is True and manifest["patient_real"] is False)

        groups = {
            "visits": ("encounters", "visit_id"),
            "medication_order_rows": ("medication_orders", "order_id"),
            "medication_products": ("medications_catalog", "drug_id"),
            "family_questions": ("family_questions", "question_id"),
            "family_observations": ("family_observations", "observation_id"),
            "family_memos": ("family_memos", "memo_id"),
        }
        counts = {name: len(master[key]) for name, (key, _) in groups.items()}
        check("master_counts_match_manifest", all(value == manifest["counts"][name] for name, value in counts.items()))
        check("master_unique_ids", all(len({row[id_key] for row in master[key]}) == len(master[key]) for key, id_key in groups.values()))
        check("seed_exports_match_master", all(read("seed/" + key + ".json") == master[key] for key in ("encounters", "medication_orders", "medications_catalog", "users")))
        visits = {row["visit_id"] for row in master["encounters"]}
        drugs = {row["drug_id"] for row in master["medications_catalog"]}
        docs = master["documents"]
        doc_ids = {row["image_id"] for row in docs}
        check("order_foreign_keys", all(row["visit_id"] in visits and row["drug_id"] in drugs and row["rx_image_id"] in doc_ids for row in master["medication_orders"]))

        images = [name for name in names if name.startswith(root + "images/") and name.endswith(".png")]
        checksums = read("images/checksums.json")
        counts["images"] = len(images)
        check("image_count_and_document_links", len(images) == len(docs) == len(checksums) == manifest["counts"]["images_expected"] and {root + d["file_path"] for d in docs} == set(images))
        check("image_checksum_links", {root + row["path"] for row in checksums} == set(images))
        check("image_hashes_and_sizes", all(hashlib.sha256(z.read(root + row["path"])).hexdigest() == row["sha256"] and len(z.read(root + row["path"])) == row["bytes"] for row in checksums) and all(hashlib.sha256(z.read(root + d["file_path"])).hexdigest() == d["sha256"] for d in docs))
        check("png_signatures", all(z.read(name).startswith(b"\x89PNG\r\n\x1a\n") for name in images))

        evaluations = {}
        for name, count_key in {
            "extraction": "extraction_cases", "mismatch": "mismatch_cases",
            "guardrail": "guardrail_cases", "permission": "permission_cases",
            "image_ocr": "images_expected",
        }.items():
            filename = f"evaluation/{name}_cases.jsonl" if name != "image_ocr" else "evaluation/image_ocr_gold.jsonl"
            cases = rows(filename)
            evaluations[name] = {
                "path": filename,
                "count": len(cases),
                "label_counts": dict(Counter(str(case.get("expected_label", case.get("expected"))) for case in cases if isinstance(case.get("expected_label", case.get("expected")), str))),
            }
            if name != "image_ocr":
                evaluations[name]["case_ids"] = [case["case_id"] for case in cases]
            check(name + "_case_count", len(cases) == manifest["counts"][count_key])
            if name != "image_ocr":
                check(name + "_unique_case_ids", len({case["case_id"] for case in cases}) == len(cases))

        audio_extensions = {".wav", ".mp3", ".m4a", ".mp4", ".webm", ".ogg", ".flac"}
        audio_count = sum(Path(name).suffix.lower() in audio_extensions for name in names)
        counts["audio_files"] = audio_count
        counts["stt_scripts"] = sum(name.startswith(root + "transcripts/visit_") and name.endswith(".txt") for name in names)
        check("audio_manifest_consistent", bool(audio_count) == manifest["audio_files_embedded"])
        check("stt_script_count", counts["stt_scripts"] == manifest["counts"]["stt_scripts"])
        return {
            "archive_name": archive.name,
            "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
            "dataset_version": manifest["dataset_version"],
            "counts": counts,
            "parsed_files": {"json": json_count, "jsonl": jsonl_count},
            "evaluation_inventory": evaluations,
            "revised_image_ids": [row["image_id"] for row in checksums if row["revision"]],
            "bundled_validation_report": {key: read("validation_report.json")[key] for key in ("passed", "failed", "checks", "limitation")},
            "checks": checks,
            "passed": sum(c["result"] == "PASS" for c in checks),
            "failed": sum(c["result"] == "FAIL" for c in checks),
            "integration": {
                "status": "reference_only",
                "active_fixture_source": "fixtures/seed and fixtures/expected",
                "excluded": ["real_mimic_reference_cases", "official_drug_catalog", "raw_mock_api", "private_notes", "question_groups_gold_from_model_input"],
            },
            "limitations": ["No OCR or STT accuracy measured", "No API authorization or AI output validation executed", "Source labels require adaptation to current three-scope contracts"],
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--report", type=Path, help="Write metadata and check results; never writes source records")
    args = parser.parse_args()
    try:
        report = inspect(args.archive)
    except (OSError, ValueError, KeyError, TypeError, BadZipFile) as error:
        parser.exit(1, f"Dataset inspection failed: {error}\n")
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Dataset {report['dataset_version']}: {report['passed']} PASS, {report['failed']} FAIL")
    for result in report["checks"]:
        if result["result"] == "FAIL":
            print("FAIL:", result["name"])
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
