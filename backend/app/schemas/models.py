from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Literal, Optional


# --- Auth ---
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    payday_day: Optional[int] = None
    currency: Optional[str] = None
    work_week: Optional[int] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr
    locale: Literal["en", "id"] = "en"


class PasswordResetVerifyRequest(BaseModel):
    request_id: str = Field(min_length=16, max_length=200)
    code: str = Field(pattern=r"^\d{6}$")


class PasswordResetConfirmRequest(BaseModel):
    reset_token: str = Field(min_length=32, max_length=512)
    new_password: str = Field(max_length=256)
    confirm_password: str = Field(max_length=256)


class PasswordResetResendRequest(BaseModel):
    request_id: str = Field(min_length=16, max_length=200)

class EmergentSessionRequest(BaseModel):
    session_token: str

class AuthResponse(BaseModel):
    token: str
    user: dict

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    currency: Optional[str] = None
    theme: Optional[str] = None
    picture: Optional[str] = None
    payday_day: Optional[int] = None
    work_week: Optional[int] = None

# --- Category ---
class CategoryCreate(BaseModel):
    label: str
    type: Literal["income", "expense"] = "expense"
    color: Optional[str] = None
    icon: Optional[str] = None


class CategoryUpdate(BaseModel):
    label: Optional[str] = None
    type: Optional[Literal["income", "expense"]] = None
    color: Optional[str] = None
    icon: Optional[str] = None

# --- Wallet ---
class WalletCreate(BaseModel):
    name: str
    type: Literal["cash", "bank", "credit_card", "e_wallet", "savings", "investment"]
    balance: float = 0.0
    currency: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    client_mutation_id: Optional[str] = None

# --- Transaction ---
class TransactionCreate(BaseModel):
    wallet_id: str
    to_wallet_id: Optional[str] = None
    type: Literal["income", "expense", "transfer"]
    amount: float
    category: str
    note: Optional[str] = ""
    date: Optional[str] = None
    currency: Optional[str] = None
    client_mutation_id: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def _amount_must_be_positive(cls, v: float) -> float:
        # A negative expense would INCREASE the wallet balance (the effect is
        # negated downstream), so the boundary must reject it outright.
        import math
        if not math.isfinite(v) or v <= 0:
            raise ValueError("amount must be greater than 0")
        return v

# --- Budget ---
class BudgetCreate(BaseModel):
    category: str
    amount: float
    period: Literal["monthly", "weekly", "yearly"] = "monthly"
    icon: Optional[str] = None
    color: Optional[str] = None
    currency: Optional[str] = None

# --- Goal ---
class GoalCreate(BaseModel):
    name: str
    target_amount: float
    saved_amount: float = 0.0
    target_date: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    kind: Literal["general", "emergency", "car", "vacation", "education", "gadget", "business"] = "general"
    currency: Optional[str] = None

class GoalContribute(BaseModel):
    amount: float

# --- Plan ---
class PlanCreate(BaseModel):
    kind: Literal["wedding", "house", "car", "vacation"]
    name: str
    total_budget: float
    target_date: Optional[str] = None
    notes: Optional[str] = ""
    currency: Optional[str] = None

# --- Debt ---
class DebtCreate(BaseModel):
    name: str
    principal: float
    remaining: float
    interest_rate: float = 0.0
    monthly_payment: float = 0.0
    due_day: Optional[int] = None
    kind: Literal["loan", "credit_card", "mortgage", "personal", "other"] = "loan"
    currency: Optional[str] = None

# --- Investment ---
class InvestmentCreate(BaseModel):
    name: str
    ticker: Optional[str] = None
    kind: Literal["stock", "etf", "mutual_fund", "bond", "crypto", "gold", "cash", "other"] = "stock"
    quantity: float = 0.0
    avg_cost: float = 0.0
    current_price: float = 0.0
    face_value: Optional[float] = None
    coupon_rate: Optional[float] = None
    purchase_price: Optional[float] = None
    current_value: Optional[float] = None
    broker: Optional[str] = None
    purchase_date: Optional[str] = None
    notes: Optional[str] = None
    currency: Optional[str] = None

# --- Asset ---
class AssetCreate(BaseModel):
    name: str
    value: float
    kind: Literal["real_estate", "vehicle", "gadget", "cash", "receivable", "other"] = "other"
    currency: Optional[str] = None

# --- Recurring ---
class RecurringCreate(BaseModel):
    name: str
    amount: float
    type: Literal["income", "expense"] = "expense"
    category: str = "Bills"
    wallet_id: str
    frequency: Literal["weekly", "monthly", "yearly"] = "monthly"
    next_date: str
    note: Optional[str] = ""
    active: bool = True
    currency: Optional[str] = None


# --- Coach ---
class CoachChatRequest(BaseModel):
    session_id: str
    message: str
