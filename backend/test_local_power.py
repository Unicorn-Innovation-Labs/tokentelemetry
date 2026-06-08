"""Tests for local-session detection, model-aware throughput, and power_meter."""

import sys
from pathlib import Path
from unittest import mock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import power_config as pc
import power_meter as pm
import pricing


# --- local-session detection ----------------------------------------------
@pytest.mark.parametrize("kwargs,expected", [
    ({"endpoint": "http://localhost:11434/v1"}, True),
    ({"endpoint": "http://127.0.0.1:8080"}, True),
    ({"endpoint": "https://api.openai.com/v1"}, False),
    ({"provider": "ollama"}, True),
    ({"provider": "lmstudio"}, True),
    ({"provider": "anthropic"}, False),
    ({"billing_mode": "local"}, True),
    ({"billing_mode": "subscription"}, False),
    ({}, False),
])
def test_is_local_session(kwargs, expected):
    assert pc.is_local_session(model_name="some-model", **kwargs) is expected


def test_user_local_endpoint_matches(tmp_path, monkeypatch):
    monkeypatch.setenv("TOKENTELEMETRY_HOME", str(tmp_path))
    (tmp_path / ".tokentelemetry").mkdir()
    (tmp_path / ".tokentelemetry" / "power.json").write_text(
        '{"localEndpoints": ["http://192.168.1.50:11434"]}')
    assert pc.is_local_session(endpoint="http://192.168.1.50:11434/api/chat") is True
    assert pc.is_local_session(endpoint="http://10.0.0.9:11434") is False


# --- model-aware throughput -----------------------------------------------
def test_tok_per_sec_scales_with_size():
    assert pc.default_tok_per_sec_for_model("nemotron-3-nano:4b") == 90.0
    assert pc.default_tok_per_sec_for_model("llama-3.3-70b") == 18.0
    assert pc.default_tok_per_sec_for_model("qwen3:0.6b") == 150.0
    # no parseable size → global default
    assert pc.default_tok_per_sec_for_model("mystery-model") == pc.DEFAULT_TOK_PER_SEC
    assert pc.default_tok_per_sec_for_model(None) == pc.DEFAULT_TOK_PER_SEC


# --- confirmed-local wins over the pricing table (the #49 collision) -------
def test_local_collision_not_priced_as_cloud(tmp_path, monkeypatch):
    monkeypatch.setenv("TOKENTELEMETRY_HOME", str(tmp_path))
    (tmp_path / ".tokentelemetry").mkdir()
    (tmp_path / ".tokentelemetry" / "power.json").write_text(
        '{"loadWatts": 65, "costPerKwh": 0.20}')
    cloud = pricing.calculate_cost("llama-3.3-70b", 5000, 2000)
    local = pricing.calculate_cost("llama-3.3-70b", 5000, 2000, provider="ollama")
    assert local < cloud / 10  # electricity is orders of magnitude cheaper
    assert local > 0


def test_measured_rate_beats_default(tmp_path, monkeypatch):
    monkeypatch.setenv("TOKENTELEMETRY_HOME", str(tmp_path))
    (tmp_path / ".tokentelemetry").mkdir()
    (tmp_path / ".tokentelemetry" / "power.json").write_text(
        '{"loadWatts": 65, "costPerKwh": 0.20}')
    slow = pricing.calculate_cost("m:4b", 0, 1000, provider="ollama", tok_per_sec=10)
    fast = pricing.calculate_cost("m:4b", 0, 1000, provider="ollama", tok_per_sec=100)
    assert slow > fast  # slower generation = more wall-clock = more energy


# --- power_meter ------------------------------------------------------------
def test_nvidia_smi_parsing(monkeypatch):
    monkeypatch.setattr(pm.shutil, "which", lambda _: "/usr/bin/nvidia-smi")
    monkeypatch.setattr(pm, "_run", lambda *a, **k: "120.5\n98.0\n")
    r = pm.read_power_watts()
    assert r["watts"] == 218.5 and r["source"] == "nvidia-smi" and r["confidence"] == "measured"


def test_no_source_returns_none(monkeypatch):
    monkeypatch.setattr(pm.shutil, "which", lambda _: None)
    monkeypatch.setattr(pm, "_macos_battery_watts", lambda: None)
    assert pm.read_power_watts() is None


def test_macos_battery_on_ac_is_none(monkeypatch):
    monkeypatch.setattr(pm.platform, "system", lambda: "Darwin")
    monkeypatch.setattr(pm, "_run", lambda *a, **k: '"ExternalConnected" = Yes\n"InstantAmperage" = 0\n"Voltage" = 13000')
    assert pm._macos_battery_watts() is None  # on AC → not a usable signal


def test_macos_battery_discharge_watts(monkeypatch):
    monkeypatch.setattr(pm.platform, "system", lambda: "Darwin")
    monkeypatch.setattr(pm, "_run", lambda *a, **k: '"ExternalConnected" = No\n"InstantAmperage" = -2000\n"Voltage" = 12000')
    # 2000 mA * 12000 mV = 2A * 12V = 24 W
    assert pm._macos_battery_watts() == 24.0
