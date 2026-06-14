# alt-kokoro-web (Python kokoro-web, the previous approach)

A docker-compose wrapper around [kokoro-web](https://github.com/eduardolat/kokoro-web)
(Python + ONNX). Kept as a reference/alternative. The supported path is now the
pure-Node `codevideo-tts` service in the parent directory.

```bash
docker compose up        # web UI + API at http://localhost:3000
docker compose up -d     # detached
```

API at http://localhost:3000/api/v1/index.html. See the kokoro-web GitHub for details.
