const { UserEnglish, CatalogoNode, MicroMastery, AttemptLog } = require('./english.models');

class EnglishService {
    
    // Processa uma tentativa, calcula Micro Domínio e verifica avanço linear
    static async processAttempt(userId, nodeId, exerciseId, score, timeMs) {
        // 1. Salva o log bruto (Auditoria)
        await new AttemptLog({ userId, nodeId, exerciseId, score, timeMs }).save();

        // 2. Busca o Nó no Catálogo para saber a trilha (track) e categoria (core/free)
        const nodeInfo = await CatalogoNode.findOne({ nodeId });
        if (!nodeInfo) throw new Error("Nó não encontrado no catálogo.");

        // 3. Busca ou cria o MicroMastery do usuário para este Nó
        let micro = await MicroMastery.findOne({ userId, nodeId });
        if (!micro) {
            micro = new MicroMastery({ userId, nodeId, track: nodeInfo.track, category: nodeInfo.category, isUnlocked: true });
        }

        // 4. FÓRMULA DE RECALCULO DE PRECISÃO E VELOCIDADE
        // Peso maior na tentativa atual (60% atual, 40% histórico)
        micro.precisionScore = micro.precisionScore === 0 ? score : (micro.precisionScore * 0.4) + (score * 0.6);
        
        // Avalia velocidade (Alvo: responder em menos de 3000ms = 100%)
        let currentSpeed = timeMs <= 3000 ? 100 : Math.max(0, 100 - ((timeMs - 3000) / 100));
        micro.speedScore = micro.speedScore === 0 ? currentSpeed : (micro.speedScore * 0.4) + (currentSpeed * 0.6);

        // 5. CÁLCULO DO MICRO DOMÍNIO POR ÁREA
        if (micro.track === 'som') {
            micro.masteryScore = micro.precisionScore; // Som foca na articulação (Áudio)
        } else if (micro.track === 'logica') {
            micro.masteryScore = (micro.precisionScore * 0.5) + (micro.speedScore * 0.5); // Lógica exige raciocínio rápido
        } else { // contexto
            micro.masteryScore = (micro.precisionScore * 0.6) + (micro.speedScore * 0.4); // Contexto exige recall
        }
        micro.masteryScore = Math.min(100, Math.round(micro.masteryScore));
        micro.lastPracticed = new Date();

        // 6. LÓGICA DE PROGRESSÃO LINEAR (Apenas avança o status, não trava pelo Domínio)
        if (!micro.isCompleted) {
            micro.mandatoryCompletedCount += 1;
            if (micro.mandatoryCompletedCount >= 5) {
                micro.isCompleted = true;
                await this.unlockNextNodes(userId, nodeInfo);
            }
        }
        await micro.save();

        // 7. Recalcula os Macros e retorna
        const newMacros = await this.recalculateMacroDomains(userId);
        return { microMastery: micro.masteryScore, isCompleted: micro.isCompleted, macros: newMacros };
    }

    // Algoritmo de Desbloqueio
    static async unlockNextNodes(userId, currentNode) {
        if (currentNode.category === 'core') {
            // Desbloqueia o próximo Core na linha
            const nextCore = await CatalogoNode.findOne({ track: currentNode.track, category: 'core', order: currentNode.order + 1 });
            if (nextCore) {
                await MicroMastery.findOneAndUpdate(
                    { userId, nodeId: nextCore.nodeId },
                    { track: nextCore.track, category: 'core', isUnlocked: true },
                    { upsert: true }
                );
            } else {
                // Se não há mais Core, desbloqueia TODOS os Free Themes daquela trilha (A Nuvem de Temas Livres)
                const freeNodes = await CatalogoNode.find({ track: currentNode.track, category: 'free' });
                for (let free of freeNodes) {
                    await MicroMastery.findOneAndUpdate(
                        { userId, nodeId: free.nodeId },
                        { track: free.track, category: 'free', isUnlocked: true },
                        { upsert: true }
                    );
                }
            }
        }
    }

    // Fórmula do Modelo Híbrido (Core vs Free)
    static async recalculateMacroDomains(userId) {
        const allMicros = await MicroMastery.find({ userId, isUnlocked: true });
        
        let macros = { som: 0, logica: 0, contexto: 0 };
        
        ['som', 'logica', 'contexto'].forEach(track => {
            const trackMicros = allMicros.filter(m => m.track === track);
            const coreMicros = trackMicros.filter(m => m.category === 'core');
            const freeMicros = trackMicros.filter(m => m.category === 'free' && m.masteryScore > 0); // Só conta os free que ele iniciou

            const avgCore = coreMicros.length > 0 ? coreMicros.reduce((acc, m) => acc + m.masteryScore, 0) / coreMicros.length : 0;
            const avgFree = freeMicros.length > 0 ? freeMicros.reduce((acc, m) => acc + m.masteryScore, 0) / freeMicros.length : 0;

            // Se o aluno já iniciou temas livres, pesa Core (80%) e Free (20%). Se não, Core vale 100%.
            if (freeMicros.length > 0) {
                macros[track] = Math.round((avgCore * 0.8) + (avgFree * 0.2));
            } else {
                macros[track] = Math.round(avgCore);
            }
        });

        // Fluência Global = Som(35%) + Lógica(35%) + Contexto(30%)
        const globalFluency = Math.round((macros.som * 0.35) + (macros.logica * 0.35) + (macros.contexto * 0.30));

        await UserEnglish.findOneAndUpdate(
            { userId },
            { macroSom: macros.som, macroLogica: macros.logica, macroContexto: macros.contexto, globalFluency },
            { upsert: true }
        );

        return { ...macros, globalFluency };
    }
}

module.exports = EnglishService;