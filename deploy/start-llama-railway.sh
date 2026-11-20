#!/usr/bin/env bash
set -euo pipefail

MODEL_DIR="${MODEL_DIR:-/models}"
MODEL_FILE="${MODEL_FILE:-qwen2.5-coder-7b-instruct-q4_k_m.gguf}"
MODEL_URL="${MODEL_URL:-https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf}"
MODEL_PATH="${MODEL_DIR}/${MODEL_FILE}"
LLAMA_CTX="${LLAMA_CTX:-16384}"
LLAMA_THREADS="${LLAMA_THREADS:-$(nproc)}"

mkdir -p "${MODEL_DIR}"

# Start MCP + OpenAI HTTP gateway immediately so Railway healthcheck passes while model downloads on first boot
node /app/qwen-mcp-gateway.mjs &
GATEWAY_PID=$!

if [ ! -f "${MODEL_PATH}" ]; then
  echo "[llama] Model not found in volume (${MODEL_PATH}). Downloading ${MODEL_FILE} (~4.36 GB) once..."
  curl -fL --retry 5 --retry-delay 5 --progress-bar -o "${MODEL_PATH}.part" "${MODEL_URL}"
  mv "${MODEL_PATH}.part" "${MODEL_PATH}"
  echo "[llama] Download complete! Cached permanently on Railway Volume."
else
  echo "[llama] Found cached model on volume: ${MODEL_PATH}"
fi

# Find llama-server binary
LLAMA_BIN="$(command -v llama-server || echo /app/llama-server)"
echo "[llama] Starting ${LLAMA_BIN} with ${MODEL_FILE} (ctx=${LLAMA_CTX}, threads=${LLAMA_THREADS}, q8_0 KV cache)..."

exec "${LLAMA_BIN}" \
  -m "${MODEL_PATH}" \
  --host 127.0.0.1 \
  --port 18080 \
  -c "${LLAMA_CTX}" \
  -t "${LLAMA_THREADS}" \
  --cache-type-k q8_0 \
  --cache-type-v q8_0 \
  --parallel 1 \
  --alias "${MODEL_FILE}"
