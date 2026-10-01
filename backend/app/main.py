from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .api import r
from .moderation import mod
from .spaces import s as spaces
from .config import settings
app = FastAPI(title='still. API', version='0.1.0', description='Private-by-default API for still. Interactive docs at /docs.')
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allow_headers=['Content-Type'])
@app.middleware('http')
async def origin_guard(req, call_next):  # CSRF defence in depth on top of SameSite=Lax cookies
    o = req.headers.get('origin')
    if req.method not in ('GET', 'HEAD', 'OPTIONS') and o and o not in settings.cors_origins and o != str(req.base_url).rstrip('/'):
        return JSONResponse({'detail': 'Origin not allowed'}, status_code=403)
    return await call_next(req)
app.include_router(r)
app.include_router(mod)
app.include_router(spaces)
