from fastapi import FastAPI
from pydantic import BaseModel
from google import genai
import os
import uvicorn

# Configuração da Chave de API da Inteligência Artificial
API_KEY = os.getenv("GEMINI_API_KEY", "COLE_SUA_CHAVE_AQUI")

# Inicializa o cliente na nova versão exigida pelo Google
client = genai.Client(api_key=API_KEY)

app = FastAPI()

class MessageRequest(BaseModel):
    message: str

@app.post("/ask")
async def ask_bot(req: MessageRequest):
    try:
        # Prompt de sistema para dar personalidade ao seu Bot
        prompt = f"Você é o CPTT Bot, um assistente virtual prestativo, educado e inteligente integrado a um aplicativo de chat premium. Responda de forma clara e amigável à seguinte mensagem:\n\nUsuário: {req.message}"
        
        # Chamada usando a nova biblioteca do Google
        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=prompt
        )
        return {"reply": response.text}
    except Exception as e:
        print(f"Erro na IA: {e}")
        return {"reply": "Desculpe, meu cérebro de IA está passando por uma atualização no momento. Tente novamente em alguns segundos! 🤖"}

if __name__ == "__main__":
    print("🤖 Cérebro Python CPTT Bot rodando na nova versão GenAI...")
    uvicorn.run(app, host="0.0.0.0", port=8000)