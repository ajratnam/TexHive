from fastapi import FastAPI, Request
from github_processor import process_github_commands

app = FastAPI()


@app.post("/code_ref")
async def code_ref(request: Request):
    content = await request.json()
    if 'content' not in content:
        return {"error": "Missing content in request"}
    content = str(content['content'])
    return process_github_commands(content)
