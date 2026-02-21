from fastapi import FastAPI
from pydantic import BaseModel
import google.generativeai as genai
import os
import uvicorn

# Configuração da Chave de API da Inteligência Artificial (Google Gemini)
# Obtenha uma chave gratuita em: https://aistudio.google.com/
API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyD5PCUGntXGgWvMgH_BrsBR-qsNs8pjOxs")

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-1.5-pro-latest')

app = FastAPI()

class MessageRequest(BaseModel):
    message: str

@app.post("/ask")
async def ask_bot(req: MessageRequest):
    try:
        # Prompt de sistema para dar personalidade ao seu Bot
        prompt = f"Você é o CPTT Bot, um assistente virtual prestativo, educado e inteligente integrado a um aplicativo de chat premium. Responda de forma clara e amigável à seguinte mensagem:\n\nUsuário: {req.message}"
        
        response = model.generate_content(prompt)
        return {"reply": response.text}
    except Exception as e:
        print(f"Erro na IA: {e}")
        return {"reply": "Desculpe, meu cérebro de IA está passando por uma atualização no momento. Tente novamente em alguns segundos! 🤖🔧"}

if __name__ == "__main__":
    print("🤖 Cérebro Python CPTT Bot rodando na porta 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)