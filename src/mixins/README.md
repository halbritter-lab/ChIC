# Mixins Module

This directory contains the mixins for the PLD-Progression Grouper application. Mixins are a flexible way to distribute reusable functionalities for Vue components.

## Contents

- `disclaimerMixin.js`: Handles the disclaimer content for the application.

### Structure

Each disclaimer section is an object with `title` and `content` properties:

```javascript
{
  title: "Section Title",
  content: "Detailed description or information."
}
```

## Usage

To use the disclaimerMixin, import it into your Vue component and mix it in:

```javascript
import disclaimerMixin from '@/mixins/disclaimerMixin';

export default {
  mixins: [disclaimerMixin],
  // Component properties and methods
};
```