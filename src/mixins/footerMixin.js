// footerMixin.js
export default {
  data() {
    return {
      // width/height are the images' intrinsic pixel sizes — rendered size is set
      // in AppFooter.vue CSS; these attributes only reserve layout space (no CLS).
      footerLinks: [
        {
          name: 'CeRKiD',
          url: 'https://nephrologie-intensivmedizin.charite.de/fuer_patienten/cerkid//',
          img: 'CeRKiD_175x130.jpg',
          alt: 'CeRKiD Logo',
          width: 175,
          height: 130,
        },
        {
          name: 'DFG',
          url: 'https://www.dfg.de/en/',
          img: 'dfg_logo_schriftzug_schwarz_foerderung_en.gif',
          alt: 'DFG Logo',
          width: 400,
          height: 130,
        },
        {
          name: 'Heisenberg-Programm',
          url: 'https://www.dfg.de/en/research-funding/funding-opportunities/programmes/individual/heisenberg',
          img: 'Heisenberg-Programm_400x235.png',
          alt: 'DFG Heisenberg-Programm Logo',
          width: 400,
          height: 235,
        },
      ],
    };
  },
};
