"""Decimal128 money handling for MongoDB + FastAPI."""

from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from bson import Decimal128
from fastapi import FastAPI


def to_decimal128(value: Any) -> Decimal128:
    """Convert a float/int/Decimal to Decimal128 for MongoDB storage."""
    if isinstance(value, Decimal128):
        return value
    if isinstance(value, Decimal):
        return Decimal128(value)
    if isinstance(value, float):
        return Decimal128(Decimal(str(value)))
    if isinstance(value, int):
        return Decimal128(Decimal(value))
    if isinstance(value, str):
        return Decimal128(Decimal(value))
    return Decimal128(Decimal(str(value)))


def from_decimal128(value: Any) -> float:
    """Convert Decimal128 from MongoDB back to a 2-decimal float for the API."""
    if isinstance(value, Decimal128):
        return float(value.to_decimal().quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    if isinstance(value, Decimal):
        return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    return round(float(value), 2) if value is not None else 0.0


def round_money(value: float) -> float:
    """Round a float to 2 decimal places using banker's rounding."""
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def convert_doc_decimals(doc: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    """Convert Decimal128 fields in a MongoDB doc to floats for the API."""
    result = dict(doc)
    for field in fields:
        if field in result and isinstance(result[field], Decimal128):
            result[field] = from_decimal128(result[field])
    return result


def convert_docs_decimals(docs: list[dict[str, Any]], fields: list[str]) -> list[dict[str, Any]]:
    return [convert_doc_decimals(d, fields) for d in docs]


class DecimalEncoder:
    """Callable for FastAPI's default encoder. Usage: jsonable_encoder(obj, custom_encoder={Decimal128: DecimalEncoder()})."""
    @staticmethod
    def encode(obj: Any) -> Any:
        if isinstance(obj, Decimal128):
            return from_decimal128(obj)
        if isinstance(obj, Decimal):
            return from_decimal128(obj)
        raise TypeError(f"Object of type {type(obj)} is not Decimal128")


def register_decimal_encoder(app: FastAPI) -> None:
    """Register JSON encoder for Decimal128 types."""
    from fastapi import encoders

    original = encoders.jsonable_encoder

    def patched_jsonable_encoder(obj: Any, *args: Any, **kwargs: Any) -> Any:
        if isinstance(obj, (Decimal128, Decimal)):
            return from_decimal128(obj)
        custom = kwargs.get("custom_encoder", {})
        if isinstance(obj, Decimal128) and Decimal128 not in custom:
            kwargs["custom_encoder"] = {**custom, Decimal128: DecimalEncoder.encode}
        return original(obj, *args, **kwargs)

    encoders.jsonable_encoder = patched_jsonable_encoder