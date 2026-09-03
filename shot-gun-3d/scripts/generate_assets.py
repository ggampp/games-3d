"""Gera SFX (ElevenLabs sound-generation) e texturas (Fal flux/schnell).

Uso: python scripts/generate_assets.py [audio|textures] [nome...]
Lê ELEVENLABS_API_KEY e FAL_KEY do ambiente (ou do .env na raiz).
"""
from __future__ import annotations

import io
import os
import sys
import urllib.request
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]


def load_env() -> None:
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


SFX: dict[str, tuple[str, float]] = {
    "step-sand": ("single soft footstep on dry desert sand, boot, close mic, no reverb", 0.6),
    "step-wood": ("single footstep on old wooden porch plank, boot, hollow creak, close mic", 0.6),
    "step-stone": ("single footstep on flat stone paving, boot heel, dry, close mic", 0.6),
    "jump": ("short cloth rustle and boot push-off, quick jump grunt-free, foley", 0.5),
    "land": ("boots landing on sand with a soft thud and gear rattle, foley", 0.7),
    "glass-break": ("small window glass shattering into shards, short, bright", 1.2),
    "stone-break": ("adobe brick wall crumbling, chunks of dry clay breaking apart, short", 1.2),
    "metal-hit": ("bullet ricochet on thick steel plate, metallic ping with short tail", 1.0),
    "bell": ("large bronze church bell single strike, long ringing decay, outdoor", 3.5),
    "hay": ("hay bale bursting apart, dry straw rustle scatter, short", 1.0),
    "creak": ("old wooden windmill slowly turning, rhythmic creaking wood loop, wind", 4.0),
    "collapse": ("large wooden structure collapsing, beams cracking and falling, dust, rumble", 3.0),
    "coin": ("gold bars clinking together, heavy metallic chime, short", 0.8),
    "wagon-roll": ("iron mine cart rolling on rails, short rumble and squeak", 2.0),
    "fire-loop": ("campfire crackling and burning wood, steady loop, no wind", 4.0),
    "extinguish": ("water hitting fire, steam hiss and sizzle, short", 1.2),
    "water-spray": ("garden hose water spraying steady stream, loop", 3.0),
    "hook-fire": ("grappling hook launcher firing, metallic clank and rope whip", 0.8),
    "hook-hit": ("iron hook striking wood and gripping, thud with rope tension creak", 0.8),
    "reload": ("shotgun shells loading and pump action reload, foley", 1.2),
    "ammo-pickup": ("picking up a box of ammunition, brass cartridges rattle, short", 0.7),
    "target-hit": ("wooden shooting range target plate ding and flip, short", 0.7),
    "target-up": ("wooden target popping up on a spring mechanism, quick clack", 0.6),
    "detonator": ("old plunger detonator being pushed down, mechanical click and clack", 0.7),
    "empty-click": ("gun trigger click on empty chamber, dry, short", 0.5),
    "fuse": ("dynamite fuse burning, hissing sparkle, loop", 2.0),
}

TEXTURES: dict[str, tuple[str, str]] = {
    "wood": ("top-down photo of weathered old west saloon wood planks, warm brown, fine grain, flat even lighting, seamless texture tile", "square_hd"),
    "adobe": ("flat close-up of sun-baked adobe clay wall, sandy tan, subtle cracks and straw, even lighting, seamless texture tile", "square_hd"),
    "sand": ("top-down photo of fine dry desert sand with small pebbles, pale ochre, even lighting, seamless texture tile", "square_hd"),
    "steel": ("flat close-up of dark brushed blued steel with light scratches, even lighting, seamless texture tile", "square_hd"),
    "brick": ("flat front view of old red clay brick wall with pale mortar, western bank, even lighting, seamless texture tile", "square_hd"),
    "hay": ("close-up of packed dry straw hay bale surface, golden, even lighting, seamless texture tile", "square_hd"),
    "sky": ("wide panoramic desert sky at late afternoon, pale blue to warm cream horizon, a few thin high clouds, no ground, no sun disc, soft gradient", "landscape_16_9"),
}


def gen_audio(names: list[str]) -> None:
    key = os.environ["ELEVENLABS_API_KEY"]
    out_dir = ROOT / "public" / "assets" / "audio"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in names:
        prompt, dur = SFX[name]
        out = out_dir / f"{name}.mp3"
        print(f"[audio] {name} ...", flush=True)
        r = requests.post(
            "https://api.elevenlabs.io/v1/sound-generation",
            headers={"xi-api-key": key, "Content-Type": "application/json"},
            json={"text": prompt, "duration_seconds": dur, "prompt_influence": 0.5},
            timeout=180,
        )
        if r.status_code != 200:
            print(f"  ERRO {r.status_code}: {r.text[:300]}", flush=True)
            continue
        out.write_bytes(r.content)
        print(f"  ok {out.name} ({len(r.content)} bytes)", flush=True)


def make_seamless(png: bytes, size: int) -> bytes:
    """Dobra a imagem em espelho 2x2 e reduz: garante borda contínua."""
    from PIL import Image

    im = Image.open(io.BytesIO(png)).convert("RGB")
    half = size // 2
    im = im.resize((half, half), Image.LANCZOS)
    tile = Image.new("RGB", (size, size))
    tile.paste(im, (0, 0))
    tile.paste(im.transpose(Image.FLIP_LEFT_RIGHT), (half, 0))
    tile.paste(im.transpose(Image.FLIP_TOP_BOTTOM), (0, half))
    tile.paste(im.transpose(Image.ROTATE_180), (half, half))
    buf = io.BytesIO()
    tile.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def gen_textures(names: list[str]) -> None:
    import fal_client

    out_dir = ROOT / "public" / "assets" / "textures"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in names:
        prompt, size = TEXTURES[name]
        print(f"[tex] {name} ...", flush=True)
        result = fal_client.subscribe(
            "fal-ai/flux/schnell",
            arguments={
                "prompt": prompt,
                "image_size": size,
                "num_inference_steps": 4,
                "num_images": 1,
                "enable_safety_checker": False,
                "output_format": "png",
            },
        )
        url = result["images"][0]["url"]
        data = urllib.request.urlopen(url, timeout=120).read()
        if name != "sky":
            data = make_seamless(data, 512)
        else:
            from PIL import Image

            im = Image.open(io.BytesIO(data)).convert("RGB").resize((1536, 864), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=88)
            data = buf.getvalue()
            (out_dir / "sky.jpg").write_bytes(data)
            print(f"  ok sky.jpg ({len(data)} bytes)", flush=True)
            continue
        (out_dir / f"{name}.png").write_bytes(data)
        print(f"  ok {name}.png ({len(data)} bytes)", flush=True)


def main() -> int:
    load_env()
    kind = sys.argv[1] if len(sys.argv) > 1 else "all"
    names = sys.argv[2:]
    if kind in ("audio", "all"):
        gen_audio(names or list(SFX))
    if kind in ("textures", "all"):
        gen_textures([n for n in names if n in TEXTURES] or list(TEXTURES))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
