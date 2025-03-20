# TexHive
#### Collaborative Realtime Personalized Tex Editor with Github Integration

---

Install Poetry

```bash
curl -sSL https://install.python-poetry.org | python3 -
```

Install Dependencies & Activate shell

```bash
poetry install
eval $(poetry env activate)
```

Install External Dependencies
```bash
sudo apt install texlive-full texlive
```

Running
```bash
python3 app.py
```

Running via Docker
1) Self build
```bash
docker compose up
```

2) Prebuilt Image
```bash
docker run -p 8000:8000 -v ./data:/app/data ajratnam/texhive
```
