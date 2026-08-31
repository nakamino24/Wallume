import ast
from pathlib import Path


AUDIT_PATH = Path(__file__).parents[1] / "scripts" / "audits" / "audit_database_compatibility.py"


def test_database_compatibility_audit_is_read_only_and_sanitized():
    source = AUDIT_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    mutation_methods = {
        "insert_one", "insert_many", "update_one", "update_many",
        "replace_one", "delete_one", "delete_many", "find_one_and_update",
        "find_one_and_delete", "bulk_write", "drop",
    }
    called_methods = {
        node.func.attr
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
    }

    assert called_methods.isdisjoint(mutation_methods)
    assert "print(args.mongo_url)" not in source
    assert "print(os.environ" not in source
    assert "sanitized counts only" in source
