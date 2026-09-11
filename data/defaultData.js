// Simplified default configuration for Live Synchronized Judging
module.exports = {
  activeCompetition: 'flags', // 'flags' or 'emblems'
  activeItemNumber: 1,        // The current design number shown on projector (e.g. 1, 2, 3...)
  votingOpen: false,          // Admin controls whether voting is open or closed
  totalItems: {
    flags: 10,                // Default 10 flags (can be adjusted dynamically by admin)
    emblems: 10               // Default 10 emblems
  },

  // 20 Judges configuration
  judges: Array.from({ length: 20 }, (_, i) => {
    const id = i + 1;
    return {
      id: id,
      name: `Judge ${id < 10 ? '0' + id : id}`,
      pin: (1000 + id).toString(), // PINs: 1001 to 1020
      active: true
    };
  }),

  // Scores structure:
  // scores[competition][itemNumber][judgeId] = { score: 8, submittedAt: ISOString }
  scores: {
    flags: {},
    emblems: {}
  }
};
