/* Planet Hop — content.
   Every fact is short, true, and written to be read aloud to a 3–4 year old. */
'use strict';

const BODIES = [
  {
    key: 'sun', name: 'Sun', color: '#FFB21E', ink: '#7A3B00',
    hello: "Hi! I'm the Sun!",
    play: "I'm super hot! Look at my cool sunglasses!",
    facts: [
      { icon: '⭐', text: "The Sun is a star! It's the closest star to us." },
      { icon: '🔥', text: 'The Sun is a giant ball of super hot, glowing gas.' },
      { icon: '🌍', text: 'The Sun is so big, more than a million Earths could fit inside it!' },
      { icon: '😎', text: 'The Sun gives us light and keeps us warm. But never look right at it. It hurts your eyes!' },
    ],
  },
  {
    key: 'mercury', name: 'Mercury', color: '#B9A48F', ink: '#4B3A2B',
    hello: "Hi! I'm Mercury!",
    play: "Zoom zoom! I'm so fast!",
    facts: [
      { icon: '🤏', text: 'Mercury is the smallest planet.' },
      { icon: '☀️', text: 'Mercury is the closest planet to the Sun.' },
      { icon: '🏃', text: 'Mercury zooms around the Sun faster than any other planet!' },
      { icon: '🕳️', text: 'Mercury is covered in bumpy craters, just like our Moon.' },
    ],
  },
  {
    key: 'venus', name: 'Venus', color: '#F2B84B', ink: '#6B4200',
    hello: "Hi! I'm Venus!",
    play: 'Puff, puff! So many clouds!',
    facts: [
      { icon: '🥵', text: 'Venus is the hottest planet. It is even hotter than Mercury!' },
      { icon: '☁️', text: 'Venus is wrapped up in thick, yellow clouds.' },
      { icon: '🔄', text: 'Venus spins the other way from most planets. The Sun comes up on the wrong side!' },
      { icon: '✨', text: 'Venus is the brightest planet in our night sky. It looks like a sparkly star!' },
    ],
  },
  {
    key: 'earth', name: 'Earth', color: '#3E8BFF', ink: '#0F3E8A',
    hello: "Hi! I'm Earth! This is our home!",
    play: 'Here comes my friend, the Moon!',
    facts: [
      { icon: '🏠', text: 'Earth is our home! You live here!' },
      { icon: '🐘', text: 'Earth is the only planet we know with plants, animals and people.' },
      { icon: '🌊', text: "Most of Earth is covered in water. That's why it looks so blue!" },
      { icon: '🌙', text: 'Earth has one Moon. It goes round and round us.' },
    ],
  },
  {
    key: 'mars', name: 'Mars', color: '#E8613C', ink: '#7A1F08',
    hello: "Hi! I'm Mars!",
    play: 'Vroom vroom! Here comes a robot rover!',
    facts: [
      { icon: '🔴', text: 'Mars is called the Red Planet. Its dust is rusty, like an old bike!' },
      { icon: '🌋', text: 'Mars has the biggest volcano in the whole solar system!' },
      { icon: '🤖', text: 'Robot rovers drive around on Mars and take pictures for us.' },
      { icon: '🥔', text: 'Mars has two tiny moons. They are lumpy, like potatoes!' },
    ],
  },
  {
    key: 'jupiter', name: 'Jupiter', color: '#E3A86B', ink: '#6A3812',
    hello: "Hi! I'm Jupiter!",
    play: 'Whoosh! My big storm is spinning!',
    facts: [
      { icon: '👑', text: 'Jupiter is the biggest planet. All the other planets could fit inside it!' },
      { icon: '🌪️', text: "Jupiter's big red spot is a giant storm. It is bigger than Earth!" },
      { icon: '🎈', text: "Jupiter is made of gas. There's no ground to stand on!" },
      { icon: '🌕', text: 'Jupiter has lots and lots of moons!' },
    ],
  },
  {
    key: 'saturn', name: 'Saturn', color: '#EBCB7C', ink: '#6B4F12',
    hello: "Hi! I'm Saturn!",
    play: 'Look at my sparkly rings go round!',
    facts: [
      { icon: '💍', text: 'Saturn has beautiful rings, made of ice and rock.' },
      { icon: '🛁', text: 'Saturn is so light, it could float in a giant bathtub!' },
      { icon: '🌕', text: 'Saturn has more moons than any other planet!' },
      { icon: '🥈', text: 'Saturn is the second biggest planet.' },
    ],
  },
  {
    key: 'uranus', name: 'Uranus', color: '#7EDCE2', ink: '#14636A',
    hello: "Hi! I'm Uranus!",
    play: 'Wheee! I roll on my side!',
    facts: [
      { icon: '🎳', text: 'Uranus spins on its side, like a ball rolling along!' },
      { icon: '🥶', text: 'Uranus is an ice giant. It is very, very cold!' },
      { icon: '🎨', text: 'Uranus is a pretty blue-green color.' },
      { icon: '🔭', text: 'Uranus was the first planet found with a telescope!' },
    ],
  },
  {
    key: 'neptune', name: 'Neptune', color: '#3F5CF5', ink: '#101F7A',
    hello: "Hi! I'm Neptune!",
    play: 'Brrr! Whoosh! It is so windy!',
    facts: [
      { icon: '🏁', text: 'Neptune is the farthest planet from the Sun.' },
      { icon: '🌬️', text: 'Neptune has the fastest winds in the whole solar system. Whoosh!' },
      { icon: '🔵', text: 'Neptune is a deep, dark blue.' },
      { icon: '🎂', text: 'A year on Neptune is so long, you would wait 165 years for your birthday!' },
    ],
  },
];

const BY_KEY = Object.fromEntries(BODIES.map(b => [b.key, b]));

/* Solar-system map. Sun centre sits off-screen; each planet rides a dotted arc
   of radius r at angle a (degrees). Coordinates are for a 1600×900 stage
   (landscape); portrait swaps the axes. d = planet diameter on the map. */
const MAP = {
  W: 1600, H: 900,
  sun: { cx: -150, cy: 450, r: 430 },
  planets: {
    mercury: { r: 520,  a: -14, d: 74 },
    venus:   { r: 640,  a: 17,  d: 104 },
    earth:   { r: 770,  a: -16, d: 110 },
    mars:    { r: 890,  a: 16,  d: 88 },
    jupiter: { r: 1080, a: -10, d: 200 },
    saturn:  { r: 1290, a: 12,  d: 150 },
    uranus:  { r: 1480, a: -10, d: 124 },
    neptune: { r: 1650, a: 8,   d: 120 },
  },
};
