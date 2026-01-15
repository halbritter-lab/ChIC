// disclaimerMixin.js
export default {
    data() {
      return {
        disclaimerSections: [
          {
            title: "Important Information for All Users",
            content: "The PLD-Progression Grouper application is intended for informational, educational, and research purposes only and should not be used as a substitute for professional medical advice or for direct diagnostic use. The tool is designed to provide insights into Polycystic Liver Disease (PLD) progression but is not meant to replace clinical decision-making or genetic consultation."
          },
          {
            title: "Usage Guidelines",
            content: "The information provided by this application is not intended for medical diagnosis or treatment decisions without the oversight of qualified healthcare professionals. Users are advised not to base any health-related decisions solely on the results obtained from this application. The data and information presented are provided without any warranty of accuracy, completeness, or usefulness. Users should exercise their own judgment in the interpretation and use of the information."
          },
          {
            title: "Liability and Risk",
            content: "The application is provided 'as is,' without any guarantees or obligations for support, updates, or accuracy. Under no circumstances shall the creators or affiliates of the PLD-Progression Grouper be liable for any direct, indirect, incidental, or consequential damages arising from the use of the application."
          },
          {
            title: "Contact and Queries",
            content: "For medical relevance of the application's content, please consult with a healthcare professional. For inquiries or feedback regarding the application, please contact <a href='mailto:info@pld-progression-grouper.org'>info@pld-progression-grouper.org</a>."
          },
          {
            title: "Acknowledgment and Consent",
            content: "By using the PLD-Progression Grouper, you acknowledge having read, understood, and agreed to the terms stated in this disclaimer. If you do not agree to these terms, you should not use the application."
          }
          // You can add more sections as needed
        ]
      };
    }
  };
  