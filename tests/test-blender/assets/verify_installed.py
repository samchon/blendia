"""Verify the actual ZIP installation, imported payload and public addon registration."""

import hashlib
import importlib
import json
import sys
import tomllib
import zipfile
from pathlib import Path, PurePosixPath

import addon_utils
import bpy


def registered():
    """Observe public RNA controls installed by this addon, without starting a background GUI bridge."""
    assert bpy.ops.blendia.start.get_rna_type().identifier == "BLENDIA_OT_start"
    assert bpy.ops.blendia.stop.get_rna_type().identifier == "BLENDIA_OT_stop"
    assert bpy.ops.blendia.run_file.get_rna_type().identifier == "BLENDIA_OT_run_file"
    assert bpy.ops.blendia.run_text.get_rna_type().identifier == "BLENDIA_OT_run_text"
    assert hasattr(bpy.types.WindowManager, "blendia_macros")


def main():
    """Match every packaged file against the genuinely imported installed addon."""
    arguments = sys.argv[sys.argv.index("--") + 1:]
    if len(arguments) != 5:
        raise ValueError("Supply archive, repository ID/directory, maintained LICENSE and observation path")
    archive_path, repository_id, repository_path, license_path, report_path = arguments
    archive_path = Path(archive_path).resolve(strict=True)
    repository_path = Path(repository_path).resolve(strict=True)
    license_path = Path(license_path).resolve(strict=True)
    with zipfile.ZipFile(archive_path) as archive:
        manifest = tomllib.loads(archive.read("blender_manifest.toml").decode("utf8"))
        package_id = manifest["id"]
        assert isinstance(package_id, str) and package_id.isidentifier()
        module_name = f"bl_ext.{repository_id}.{package_id}"
        enabled_default, enabled_loaded = addon_utils.check(module_name)
        assert enabled_default and enabled_loaded, "install-file --enable must persist and load this addon"
        module = importlib.import_module(module_name)
        module_file = Path(module.__file__).resolve(strict=True)
        installed = module_file.parent
        assert module_file.name == "__init__.py"
        assert installed == (repository_path / package_id).resolve(strict=True)
        registered()
        payload_files = 0
        for member in archive.infolist():
            if member.is_dir():
                continue
            relative = PurePosixPath(member.filename)
            assert not relative.is_absolute() and ".." not in relative.parts
            target = (installed / Path(*relative.parts)).resolve(strict=True)
            assert target.is_relative_to(installed) and target.is_file()
            actual = target.read_bytes()
            expected = archive.read(member)
            assert hashlib.sha256(actual).digest() == hashlib.sha256(expected).digest(), member.filename
            payload_files += 1
        assert payload_files > 0
        assert (installed / "headless_bootstrap.py").is_file()
        actual_license = (installed / "LICENSE").read_bytes()
        assert actual_license == license_path.read_bytes()

    # Use Blender's actual addon lifecycle to prove registration, rather than importing source as a stand-in.
    addon_utils.disable(module_name, default_set=False)
    assert not addon_utils.check(module_name)[1]
    assert not hasattr(bpy.types.WindowManager, "blendia_macros")
    addon_utils.enable(module_name, default_set=False)
    assert addon_utils.check(module_name)[1]
    registered()
    assert Path(importlib.import_module(module_name).__file__).resolve(strict=True) == module_file
    report = {
        "moduleName": module_name,
        "moduleFile": str(module_file),
        "extensionDirectory": str(installed),
        "archiveSha256": hashlib.sha256(archive_path.read_bytes()).hexdigest(),
        "payloadFiles": payload_files,
        "licenseSha256": hashlib.sha256(actual_license).hexdigest(),
        "registrationVerified": True,
    }
    with Path(report_path).open("x", encoding="utf8") as output:
        json.dump(report, output, indent=2)
    print("BLENDIA_INSTALLED_EXTENSION_REGISTERED_OK")


main()
