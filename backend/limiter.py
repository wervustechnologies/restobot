from settings import settings

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Storage backend: in-memory by default. Flip to Redis across all gunicorn
# workers by setting RATELIMIT_STORAGE_URI=redis://... in the environment.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.ratelimit_default],
    storage_uri=settings.ratelimit_storage_uri,
)

# Per-category limits (also env-overridable). Public endpoints opt in to one of
# these via @limiter.limit(...). Authenticated endpoints fall back to
# default_limits above and need no decorator.
LIMIT_AUTH = settings.ratelimit_auth          # login brute-force
LIMIT_PUBLIC_WRITE = settings.ratelimit_write  # POST creates / writes
LIMIT_AI = settings.ratelimit_ai              # recommend / chat
LIMIT_PUBLIC_READ = settings.ratelimit_read    # public GETs
