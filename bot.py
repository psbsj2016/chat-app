from fastapi import FastAPI
from pydantic import BaseModel
import requests
import os
import uvicorn

# Configuração da Chave de API da Inteligência Artificial
API_KEY = os.getenv("GEMINI_API_KEY", "COLE_SUA_CHAVE_AQUI")

app = FastAPI()

class MessageRequest(BaseModel):
    message: str

@app.post("/ask")
async def ask_bot(req: MessageRequest):
    try:
        # A MÁGICA: Aqui nós definimos a dupla personalidade do Bot!
        prompt = f"""Você é o CPTT Bot, o assistente virtual super inteligente, educado e amigável do aplicativo de chat CPTT.
        
        NOVA DIRETRIZ: Você agora possui um minigame secreto embutido chamado 'Detetive CPTT'.
        Se o usuário disser algo como "vamos jogar", "jogar detetive", "quero um mistério" ou iniciar uma investigação, VOCÊ DEVE ATIVAR O MODO JOGO IMEDIATAMENTE.

        REGRAS DO MODO DETETIVE:
        1. Invente um crime ou sumiço misterioso na sede do CPTT (seja criativo e divertido. Ex: O roubo do roteador de Wi-Fi de Ouro, o sumiço do café sagrado dos programadores).
        2. Apresente o cenário do crime e 3 suspeitos com nomes e personalidades BEM diferentes.
        3. Diga para o usuário (o Detetive) começar a investigação fazendo perguntas para você (que vai interpretar os suspeitos, as testemunhas e o narrador).
        4. O Segredo: Apenas um suspeito é o culpado de verdade. Você deve deixar pequenas pistas e contradições escondidas no depoimento do culpado.
        5. Se o usuário disser que quer "Acusar", peça o nome do suspeito e o motivo. Revele a verdade de forma super dramática (com emojis) e diga se ele venceu ou perdeu!

        Se o usuário NÃO falar de jogo, aja normalmente como um assistente respondendo à mensagem dele.

        Mensagem do Usuário: {req.message}"""
        
        # Chamada super blindada e universal para a API
        url = f"https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key={API_KEY}"
        
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        headers = {"Content-Type": "application/json"}
        
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        if 'error' in data:
            return {"reply": f"🚨 O Google barrou a comunicação. Motivo: {data['error'].get('message')}"}
            
        reply_text = data['candidates'][0]['content']['parts'][0]['text']
        return {"reply": reply_text}
        
    except Exception as e:
        print(f"Erro na IA: {e}")
        return {"reply": f"🚨 Erro interno no Python: {str(e)}"}

if __name__ == "__main__":
    print("🤖 Cérebro Python CPTT Bot rodando com o Módulo Detetive Ativado...")
    uvicorn.run(app, host="0.0.0.0", port=8000)