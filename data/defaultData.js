// Initial default configuration and seed data
module.exports = {
  activeCompetition: 'flags', // 'flags' or 'emblems'
  activeItemId: 'flag-1',
  votingLocked: false,
  broadcastActiveItem: true, // when true, changing item on admin navigates judges

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

  // Competitions and Items
  competitions: {
    flags: {
      id: 'flags',
      name: 'කොඩි තේරීමේ තරඟය (Flag Competition)',
      description: 'ආයතනයේ හොඳම කොඩිය තේරීම සඳහා 1 සිට 10 දක්වා ලකුණු ලබා දෙන්න.',
      items: [
        {
          id: 'flag-1',
          number: 1,
          title: 'Flag #01',
          description: 'නිර්මාණ අංක 01 (Design #01)',
          imageUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&auto=format&fit=crop&q=80'
        },
        {
          id: 'flag-2',
          number: 2,
          title: 'Flag #02',
          description: 'නිර්මාණ අංක 02 (Design #02)',
          imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80'
        },
        {
          id: 'flag-3',
          number: 3,
          title: 'Flag #03',
          description: 'නිර්මාණ අංක 03 (Design #03)',
          imageUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&auto=format&fit=crop&q=80'
        },
        {
          id: 'flag-4',
          number: 4,
          title: 'Flag #04',
          description: 'නිර්මාණ අංක 04 (Design #04)',
          imageUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80'
        },
        {
          id: 'flag-5',
          number: 5,
          title: 'Flag #05',
          description: 'නිර්මාණ අංක 05 (Design #05)',
          imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80'
        }
      ]
    },
    emblems: {
      id: 'emblems',
      name: 'ලාංඡන තේරීමේ තරඟය (Emblem Competition)',
      description: 'ආයතනයේ හොඳම ලාංඡනය තේරීම සඳහා 1 සිට 10 දක්වා ලකුණු ලබා දෙන්න.',
      items: [
        {
          id: 'emblem-1',
          number: 1,
          title: 'Emblem #01',
          description: 'නිර්මාණ අංක 01 (Design #01)',
          imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'
        },
        {
          id: 'emblem-2',
          number: 2,
          title: 'Emblem #02',
          description: 'නිර්මාණ අංක 02 (Design #02)',
          imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'
        },
        {
          id: 'emblem-3',
          number: 3,
          title: 'Emblem #03',
          description: 'නිර්මාණ අංක 03 (Design #03)',
          imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'
        },
        {
          id: 'emblem-4',
          number: 4,
          title: 'Emblem #04',
          description: 'නිර්මාණ අංක 04 (Design #04)',
          imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'
        }
      ]
    }
  },

  // Scores structure:
  // scores[competitionId][itemId][judgeId] = { score: 8, comment: 'Good colors', submittedAt: ISOString }
  scores: {
    flags: {},
    emblems: {}
  }
};
