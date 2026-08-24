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
