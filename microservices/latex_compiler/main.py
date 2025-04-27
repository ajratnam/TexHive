from fastapi import FastAPI, Request
from latex_compiler import compile_latex_file

app = FastAPI()

@app.post("/compile")
async def code_ref(request: Request):
    tex_file = await request.json()
    if 'tex_file' not in tex_file:
        return {"error": "Missing content in request"}
    tex = str(tex_file['tex_file'])
    warning = tex_file.get('ignore_warnings', False)
    uid = tex_file.get('uid', "")
    return compile_latex_file(uid, tex, warning)