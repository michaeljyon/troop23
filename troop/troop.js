/**
 * Troop settings — the one file to edit.
 *
 * Secrets are NOT kept here. Set these in Netlify → Site configuration →
 * Environment variables:
 *   TROOP_CODE       the code scouts and families type to open the app
 *   LEADER_PASSCODE  the passcode for leader tools (#/leaders)
 *
 * Patrol names can also be changed from the leader tools without editing code.
 */
const troop = {
  id: 'troop23-tlh',                      // storage name; change only for a brand-new app
  unit: 'Troop 23',
  appName: 'Troop 23 Basecamp',
  shortName: 'Basecamp',
  place: 'Tallahassee, Florida',
  tagline: 'Plan it. Pack it. Cook it. Share it.',
  contactEmail: '',                       // optional, shown on the permission page
  year: '2026–27',

  // Official artwork (optional). Put the files in public/brand/ and set the
  // paths, e.g. logo: '/brand/scouts-bsa-logo.png'. Until then the app uses
  // its "Troop 23" lettering.
  logo: '',          // shown in the header and on the sign-in screen
  logoOnDark: '',    // a white/reversed version for dark backgrounds, if you have one

  colors: {
    primary: '#1E4A36',                   // forest green
    primaryDark: '#12301F',
    accent: '#E8833A',                    // campfire orange
    accentInk: '#2B1300',
    khaki: '#D9CDA8',
  },

  // Starting patrols (leaders can rename/add these in Leader tools → Settings).
  patrols: ['Flaming Arrows', 'Hawks', 'Sharks', 'Adults'],

  outingTypes: [
    { id: 'campout', label: 'Campout', emoji: '🏕️' },
    { id: 'hike', label: 'Hike', emoji: '🥾' },
    { id: 'paddle', label: 'Paddle', emoji: '🛶' },
    { id: 'service', label: 'Service', emoji: '🤝' },
    { id: 'meeting', label: 'Meeting', emoji: '📋' },
    { id: 'trip', label: 'Trip', emoji: '🚐' },
    { id: 'other', label: 'Other', emoji: '⭐' },
  ],

  // Photo albums that aren't tied to an outing (every outing is its own album).
  albums: [
    { id: 'meetings', title: 'Troop meetings', emoji: '📋' },
    { id: 'coh', title: 'Courts of Honor', emoji: '🏅' },
    { id: 'service', title: 'Service projects', emoji: '🤝' },
    { id: 'fun', title: 'Just for fun', emoji: '📸' },
  ],

  missions: ['Our whole patrol', 'Camp kitchen', 'Trail view', 'Campfire', 'Teaching a skill', 'Service in action', 'Gear setup', 'Summit!'],

  gearCategories: ['Shelter', 'Cooking', 'Water', 'Lighting', 'Tools', 'Safety & first aid', 'Program', 'Other'],

  // Patrol duty roster roles, rotated across meals.
  dutyRoles: ['Cook', 'Assistant cook', 'Fire & water', 'Cleanup'],

  // Personal packing list. Leaders add outing-specific extras.
  packing: [
    { group: 'Wear', items: ['Field uniform or activity shirt', 'Hiking boots or sturdy shoes', 'Hat'] },
    { group: 'Outdoor essentials', items: ['Pocketknife (Totin\' Chip)', 'Personal first-aid kit', 'Extra clothing', 'Rain gear', 'Water bottle (full)', 'Flashlight or headlamp', 'Trail food', 'Matches / fire starter', 'Sun protection', 'Map & compass'] },
    { group: 'Sleep', items: ['Tent (or tent partner)', 'Sleeping bag', 'Sleeping pad', 'Pillow'] },
    { group: 'Eat', items: ['Mess kit (plate, bowl, cup)', 'Spoon / fork', 'Dish towel'] },
    { group: 'Personal', items: ['Toothbrush & toothpaste', 'Medications (to adult leader)', 'Bug repellent', 'Change of clothes per day', 'Extra socks', 'Scout handbook', 'Health form on file'] },
  ],

  photos: { requireApproval: true, maxPerUpload: 10 },

  shareRules: [
    'I\'m a {unit} scout, parent or leader.',
    'I took this photo or have permission to share it.',
    'No full names, schools, addresses or other personal details in captions.',
    'Leaders review every photo before the troop can see it and may remove any photo.',
    '{unit} may post a photo publicly only if every scout in it has public permission.',
  ],

  consentLevels: [
    { id: 'public', label: 'Yes, share it', short: 'Public OK',
      text: 'My scout can appear in photos in this private troop gallery and on {unit}\'s public pages, like our website or social media. A scout\'s full name, school or address is never posted with a photo.' },
    { id: 'troop', label: 'Troop only', short: 'Troop only',
      text: 'My scout can appear in photos in this private gallery, which only {unit} families can open with the troop code. Please don\'t post photos of my scout publicly.' },
    { id: 'none', label: 'No photos, please', short: 'No photos',
      text: 'Please don\'t share photos of my scout. Leaders will hide any photo my scout is in.' },
  ],

  consentTerms: [
    'I\'m the parent or legal guardian of the scout(s) listed.',
    'My choices apply to photos taken at {unit} meetings, outings and events for the {year} year.',
    'I can change or withdraw my choices any time in this app or by telling a leader. Changes apply to photos shared after that.',
    'No one is paid for photos, and photo choices never affect a scout\'s participation.',
  ],

  // Starter recipe library (scouts can add their own). Quantities are for `serves`.
  recipes: [
    { id: 'r-burritos', title: 'Breakfast burritos', meal: 'breakfast', method: 'Stove', serves: 8,
      ingredients: [['Eggs', 16, 'each'], ['Flour tortillas (large)', 10, 'each'], ['Breakfast sausage', 1.5, 'lb'], ['Shredded cheese', 2, 'cups'], ['Salsa', 1, 'jar'], ['Cooking oil', 2, 'tbsp']],
      steps: ['Brown the sausage in a skillet; drain the grease into a can, not on the ground.', 'Scramble the eggs in the same pan until just set.', 'Warm tortillas on a dry pan.', 'Fill with eggs, sausage, cheese and salsa. Roll and serve.'] },
    { id: 'r-pancakes', title: 'Pancakes & bacon', meal: 'breakfast', method: 'Griddle', serves: 8,
      ingredients: [['Pancake mix (just add water)', 4, 'cups'], ['Bacon', 2, 'lb'], ['Syrup', 1, 'bottle'], ['Butter', 0.5, 'lb'], ['Orange juice', 1, 'gal']],
      steps: ['Cook bacon first and keep warm in foil.', 'Mix pancake batter until just combined (lumps are fine).', 'Wipe griddle with a little bacon fat, pour ¼ cup per pancake, flip when bubbles pop.'] },
    { id: 'r-oatmeal', title: 'Oatmeal bar', meal: 'breakfast', method: 'Stove', serves: 8,
      ingredients: [['Instant oatmeal packets', 16, 'each'], ['Brown sugar', 1, 'cups'], ['Raisins', 1, 'cups'], ['Bananas', 8, 'each'], ['Hot cocoa packets', 8, 'each']],
      steps: ['Boil a big pot of water.', 'Everyone mixes their own oatmeal in their bowl with toppings.', 'Use leftover hot water for cocoa and dishes.'] },
    { id: 'r-walkingtacos', title: 'Walking tacos', meal: 'lunch', method: 'Stove', serves: 8,
      ingredients: [['Ground beef', 2.5, 'lb'], ['Taco seasoning', 2, 'packet'], ['Single-serve corn chip bags', 8, 'each'], ['Shredded lettuce', 1, 'bag'], ['Shredded cheese', 2, 'cups'], ['Sour cream', 1, 'tub'], ['Salsa', 1, 'jar']],
      steps: ['Brown the beef, drain, add seasoning and water per packet.', 'Crush chips lightly in the bag and cut the bag open on the side.', 'Spoon in meat and toppings. Eat with a fork right out of the bag — almost no dishes.'] },
    { id: 'r-wraps', title: 'Trail wraps & fruit', meal: 'lunch', method: 'No cook', serves: 8,
      ingredients: [['Flour tortillas', 10, 'each'], ['Deli turkey', 1.5, 'lb'], ['Sliced cheese', 16, 'slices'], ['Apples', 8, 'each'], ['Granola bars', 8, 'each'], ['Mustard / mayo packets', 16, 'each']],
      steps: ['Keep meat and cheese in the cooler until lunch.', 'Build wraps, roll tightly, and pack with fruit and a bar.'] },
    { id: 'r-foil', title: 'Foil packet dinners', meal: 'dinner', method: 'Coals', serves: 8,
      ingredients: [['Ground beef patties', 8, 'each'], ['Potatoes', 4, 'lb'], ['Carrots', 2, 'lb'], ['Onions', 2, 'each'], ['Heavy-duty foil', 1, 'roll'], ['Butter', 0.5, 'lb'], ['Salt & pepper', 1, 'set']],
      steps: ['Slice potatoes, carrots and onion thin so they cook through.', 'Lay a patty on a double sheet of foil, pile veggies on top with a pat of butter, season.', 'Seal tightly and label with a marker.', 'Cook on hot coals 15–20 minutes per side. Beef must reach 160°F.'] },
    { id: 'r-chilimac', title: 'One-pot chili mac', meal: 'dinner', method: 'Stove', serves: 8,
      ingredients: [['Ground beef', 2, 'lb'], ['Elbow macaroni', 2, 'lb'], ['Canned chili beans', 2, 'can'], ['Diced tomatoes', 2, 'can'], ['Chili seasoning', 2, 'packet'], ['Shredded cheese', 2, 'cups']],
      steps: ['Brown beef in a big pot, drain.', 'Add beans, tomatoes, seasoning and 6 cups water; bring to a boil.', 'Stir in macaroni and simmer 10–12 minutes, stirring so it doesn\'t stick.', 'Top with cheese.'] },
    { id: 'r-cobbler', title: 'Dutch oven peach cobbler', meal: 'dessert', method: 'Dutch oven', serves: 10,
      ingredients: [['Canned peaches', 3, 'can'], ['Yellow cake mix', 1, 'box'], ['Butter', 1, 'stick'], ['Cinnamon', 1, 'tsp'], ['Dutch oven liner', 1, 'each']],
      steps: ['Line a 12" dutch oven. Pour in peaches with juice.', 'Sprinkle dry cake mix evenly over the top. Dot with butter slices and cinnamon.', 'Bake with about 8 coals below and 16 on top for 45 minutes. Rotate the oven and lid every 15 minutes.'] },
    { id: 'r-smores', title: 'S\'mores', meal: 'dessert', method: 'Campfire', serves: 8,
      ingredients: [['Graham crackers', 1, 'box'], ['Chocolate bars', 8, 'each'], ['Marshmallows', 1, 'bag']],
      steps: ['Toast marshmallows over coals, not flames.', 'Sandwich with chocolate between graham crackers.'] },
  ],
};

export default troop;
