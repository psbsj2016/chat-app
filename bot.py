from fastapi import FastAPI
from pydantic import BaseModel
import requests
import os
import re
import uvicorn

app = FastAPI()

# Token Gratuito do HuggingFace (Defina nas variáveis de ambiente do Render)
HF_API_KEY = os.getenv("HF_API_KEY", "COLE_SEU_TOKEN_HUGGINGFACE_AQUI")

# Modelo Open-Source Leve e Poderoso (Mistral Instruct ou Zephyr)
API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3"
HEADERS = {"Authorization": f"Bearer {HF_API_KEY}"}

class ChatRequest(BaseModel):
    message: str

class GameRequest(BaseModel):
    prompt: str

def query_huggingface(prompt: str):
    payload = {
        "inputs": prompt,
        "parameters": {"max_new_tokens": 1024, "return_full_text": False, "temperature": 0.7}
    }
    response = requests.post(API_URL, headers=HEADERS, json=payload)
    if response.status_code == 200:
        return response.json()[0]['generated_text']
    else:
        raise Exception(f"Erro HF: {response.text}")

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        # Prompt de Sistema para o Assistente Geral
        system_prompt = f"<s>[INST] Você é a IA do ChatPTT, um assistente prestativo, jovem e amigável. Responda em Português do Brasil de forma clara e curta. Usuário diz: {req.message} [/INST]"
        
        reply = query_huggingface(system_prompt)
        return {"reply": reply.strip()}
    except Exception as e:
        return {"reply": f"🚨 Falha nos circuitos neurais (HuggingFace): {str(e)}"}

@app.post("/criar-jogo")
async def create_game_endpoint(req: GameRequest):
    try:
        # Prompt Mágico de Engenharia de Software
        system_prompt = f"""<s>[INST] Você é um Desenvolvedor Web Sênior. O usuário pediu: '{req.prompt}'.
Crie um jogo completo em UM ÚNICO arquivo HTML. 
Inclua o CSS dentro de <style> e o JavaScript dentro de <script>. 
Não use bibliotecas externas pesadas. O jogo deve caber em uma tela de celular (responsivo).
Retorne APENAS o código HTML. Não escreva nenhuma explicação antes ou depois do código. [/INST]"""
        
        raw_output = query_huggingface(system_prompt)
        
        # Limpeza do código: Remove blocos de markdown ```html ... ``` se a IA enviar
        clean_code = re.sub(r'```(?:html)?\n?(.*?)\n?```', r'\1', raw_output, flags=re.DOTALL)
        
        return {"code": clean_code.strip()}
    except Exception as e:
        return {"error": str(e)}

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host='0.0.0.0', port=port)