from pathlib import Path


class Config:
    BASE_DIR = Path.cwd()
    DATA_DIR = BASE_DIR / "data"
    TEMP_DIR = BASE_DIR / "temp"


Config.DATA_DIR.mkdir(exist_ok=True)
Config.TEMP_DIR.mkdir(exist_ok=True)
