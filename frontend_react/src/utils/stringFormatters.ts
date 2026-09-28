/**
 * Formata um nome completo para Title Case.
 * Exemplo: "RENATO DA SILVA SUCUPIRA" -> "Renato da Silva Sucupira"
 */
export const toTitleCase = (text: string | null | undefined): string => {
  if (!text) return '';

  // Lista de preposições que devem ficar em minúsculo
  const prepositions = ['da', 'de', 'do', 'das', 'dos', 'e'];

  return text
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      // Se a palavra for uma preposição e não for a primeira palavra, mantém minúscula
      if (prepositions.includes(word) && index > 0) {
        return word;
      }
      
      // Capitaliza a primeira letra e concatena com o resto da palavra
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

/**
 * Formata a localidade/base operacional para o padrão: "Cidade - UF".
 * Remove duplicatas (ex: "RIO DE JANEIRO/RJ,RIO DE JANEIRO/RJ" -> "Rio de Janeiro - RJ")
 * e formata a cidade em Title Case e a UF em maiúsculo.
 */
export const formatLocalEquipe = (base: string | null | undefined): string => {
  if (!base || !base.trim()) return '';

  // Divide por vírgulas para tratar múltiplas bases
  const parts = base.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';

  // Remove duplicidades insensíveis a maiúsculas/minúsculas
  const uniqueParts: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const normalized = part.toUpperCase().replace(/\s+/g, ' ');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueParts.push(part);
    }
  }

  const formattedParts = uniqueParts.map(part => {
    // Formato com barra: "CIDADE/UF" (ex: "RIO DE JANEIRO/RJ")
    if (part.includes('/')) {
      const [cidade, uf] = part.split('/');
      const cidadeFormatada = toTitleCase(cidade.trim());
      const ufFormatada = (uf || '').trim().toUpperCase();
      return ufFormatada ? `${cidadeFormatada} - ${ufFormatada}` : cidadeFormatada;
    }

    // Formato com hífen: "CIDADE - UF" (ex: "RIO DE JANEIRO - RJ")
    if (part.includes(' - ') || part.includes('-')) {
      const [cidade, uf] = part.includes(' - ') ? part.split(' - ') : part.split('-');
      const cidadeFormatada = toTitleCase(cidade.trim());
      const ufFormatada = (uf || '').trim().toUpperCase();
      return ufFormatada ? `${cidadeFormatada} - ${ufFormatada}` : cidadeFormatada;
    }

    // Texto livre (ex: "Base Central")
    return toTitleCase(part);
  });

  return formattedParts.join(', ');
};

