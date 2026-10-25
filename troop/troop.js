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
  patrols: ['American Gladiators', 'Boxing Goldfish', 'Fiery Ferrets', 'Flaming Flamingos', 'Iron Horses', 'Spartans', 'Speedy Sloths', 'Wandering Woodsman', 'Adults'],

  outingTypes: [
    { id: 'campout', label: 'Campout', emoji: '🏕️' },
    { id: 'hike', label: 'Hike', emoji: '🥾' },
    { id: 'paddle', label: 'Paddle', emoji: '🛶' },
    { id: 'service', label: 'Service', emoji: '🤝' },
    { id: 'fundraiser', label: 'Fundraiser', emoji: '🎄' },
    { id: 'meeting', label: 'Meeting', emoji: '📋' },
    { id: 'merit', label: 'Merit badge', emoji: '🏅' },
    { id: 'training', label: 'Training', emoji: '🎓' },
    { id: 'oa', label: 'Order of the Arrow', emoji: '🏹' },
    { id: 'camp', label: 'Summer/winter camp', emoji: '⛺' },
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

  // Budget calculator defaults: food dollars per person per meal, and what
  // to round the "collect from each scout" amount up to.
  mealCosts: { breakfast: 3, lunch: 4, dinner: 6, snack: 1.5, roundTo: 5 },

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
  // Leadership positions (from TroopWebHost → Leadership Positions), offered when leaders edit a member
  positions: {
    youth: ["Assistant Patrol Leader", "Assistant Quartermaster", "Assistant Senior Patrol Leader", "Bugler", "Chaplain's Aide", "Den Chief", "Historian", "Junior Assistant Scoutmaster", "Librarian", "Order of the Arrow Representative", "Outdoor Ethics Guide", "Patrol Leader", "Patrol Quartermaster", "Quartermaster (PLC)", "Scout Webmaster", "Scribe", "Senior Patrol Leader", "SPL - Elect", "Troop Guide"],
    adult: ["Advancement Coordinator", "Assistant District Commissioner", "Assistant Scoutmaster", "Board of Review Coordinator", "Chaplain", "Chartered Organization Representative", "Christmas Tree Coordinator", "Christmas Tree Coordinator In Training", "Committee Advancement Chair", "Committee Chair", "Committee Equipment Coordinator", "Committee Fundraising Chair", "Committee Life To Eagle Coach", "Committee Member", "Committee Merit Badge Coordinator", "Committee Outdoor Activities Chair", "Committee Secretary", "Committee Service Chair", "Committee Training Chair", "Committee Transportation Chair", "Committee Treasurer", "Committee Vice Chairman", "Cub Scout Liaison", "District Commissioner", "District Executive", "Eagle Scout Coordinator", "Eagle Scout Court of Honor Advisor", "Equipment Coordinator", "Event Coordinator", "Executive Officer of Chartered Organization", "Finance Committee Member", "Friends of Scouting Coordinator", "Fundraiser Committee Member", "Fundraising Coordinator", "Historian", "Leave No Trace Trainer", "Membership Coordinator", "Merit Badge Counselor", "Order of the Arrow Troop Adviser", "Outdoor Activities Coordinator", "Outdoor Ethics Guide Advisor", "Parent Scout Coordinator", "Patrol Advisor", "Public Relations Coordinator", "Records Coordinator", "Recruiting Coordinator", "Registered Adult Leader", "Round Table Representative", "Scholarship Points Coordinator", "Scouting For Food Coordinator", "Scoutmaster", "Secretary", "Summer Camp Coordinator", "Summer/Winter Camp Coordinator", "Training Coordinator", "Treasurer", "Unit Commissioner", "Unit Scouter Reserve", "Webmaster"],
  },
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
    // ---- more troop classics
    { id: 'r-mountainman', title: 'Mountain man breakfast', meal: 'breakfast', method: 'Dutch oven', serves: 10,
      ingredients: [['Breakfast sausage', 2, 'lb'], ['Frozen hash browns', 2, 'lb'], ['Eggs', 18, 'each'], ['Onion', 1, 'each'], ['Bell pepper', 1, 'each'], ['Shredded cheese', 3, 'cups'], ['Salt & pepper', 1, 'set'], ['Dutch oven liner', 1, 'each']],
      steps: ['Brown the sausage with chopped onion and pepper in a lined 12" dutch oven; drain.', 'Spread hash browns over the top and cook, stirring, until they start to brown.', 'Beat the eggs, season, and pour over everything. Do not stir.', 'Lid on: about 8 coals below and 16 on top for 20–25 minutes until the eggs are set.', 'Cover with cheese, lid back on 3 minutes to melt.'] },
    { id: 'r-frenchtoast', title: 'Griddle French toast', meal: 'breakfast', method: 'Griddle', serves: 8,
      ingredients: [['Thick bread (Texas toast)', 2, 'loaf'], ['Eggs', 12, 'each'], ['Milk', 2, 'cups'], ['Cinnamon', 2, 'tsp'], ['Vanilla', 1, 'tsp'], ['Butter', 0.5, 'lb'], ['Syrup', 1, 'bottle'], ['Powdered sugar', 1, 'cups']],
      steps: ['Whisk eggs, milk, cinnamon and vanilla in a wide pan.', 'Dip each slice for two seconds per side.', 'Cook on a buttered medium griddle until golden, about 2–3 minutes per side.', 'Serve with syrup and a dusting of powdered sugar.'] },
    { id: 'r-baggies', title: 'Omelets in a bag', meal: 'breakfast', method: 'Stove', serves: 8,
      ingredients: [['Eggs', 16, 'each'], ['Quart freezer bags (zip, boil-safe)', 8, 'each'], ['Diced ham', 1, 'lb'], ['Shredded cheese', 2, 'cups'], ['Bell pepper', 1, 'each'], ['Salsa', 1, 'jar'], ['Permanent marker', 1, 'each']],
      steps: ['Bring a big pot of water to a rolling boil.', 'Each scout writes their name on a bag, cracks in 2 eggs, adds fillings, squeezes out the air and seals.', 'Squish to mix, then lower the bags into the boiling water (8–10 at a time, not touching the pot sides).', 'Boil 13 minutes until the eggs are set. Roll out onto the plate.'] },
    { id: 'r-biscuitsgravy', title: 'Biscuits & sausage gravy', meal: 'breakfast', method: 'Dutch oven', serves: 8,
      ingredients: [['Canned biscuits', 2, 'can'], ['Breakfast sausage', 2, 'lb'], ['Flour', 0.5, 'cups'], ['Milk', 4, 'cups'], ['Black pepper', 1, 'tsp'], ['Dutch oven liner', 1, 'each']],
      steps: ['Bake biscuits in a lined dutch oven: about 7 coals below and 17 on top, 12–15 minutes.', 'Meanwhile brown the sausage in a skillet; do not drain.', 'Sprinkle in the flour and stir 1 minute.', 'Slowly stir in the milk and simmer until thick. Season with plenty of pepper.', 'Split biscuits and ladle gravy over the top.'] },
    { id: 'r-grilledcheese', title: 'Grilled cheese & tomato soup', meal: 'lunch', method: 'Griddle', serves: 8,
      ingredients: [['Sandwich bread', 2, 'loaf'], ['American cheese', 24, 'slices'], ['Butter', 0.5, 'lb'], ['Condensed tomato soup', 4, 'can'], ['Milk', 4, 'cups']],
      steps: ['Heat soup with milk (one can of milk per can of soup), stirring so it does not scorch.', 'Butter the outsides of the bread, 3 slices of cheese per sandwich.', 'Cook on a medium griddle until golden and melty, 2–3 minutes per side.', 'Cut corner to corner and dunk.'] },
    { id: 'r-pieiron', title: 'Pie-iron pizzas', meal: 'lunch', method: 'Campfire', serves: 8,
      ingredients: [['Sandwich bread', 2, 'loaf'], ['Pizza sauce', 1, 'jar'], ['Shredded mozzarella', 3, 'cups'], ['Pepperoni', 8, 'oz'], ['Butter or cooking spray', 1, 'each'], ['Pie irons', 4, 'each']],
      steps: ['Butter one side of two slices of bread and put them butter-side out in the pie iron.', 'Add sauce, cheese and pepperoni. Close and trim the crusts.', 'Cook over coals 3–4 minutes per side, checking often.', 'Let it cool a minute: the filling is lava hot.'] },
    { id: 'r-quesadillas', title: 'Chicken quesadillas', meal: 'lunch', method: 'Griddle', serves: 8,
      ingredients: [['Flour tortillas (large)', 16, 'each'], ['Canned chicken', 3, 'can'], ['Shredded Mexican cheese', 4, 'cups'], ['Taco seasoning', 1, 'packet'], ['Salsa', 1, 'jar'], ['Sour cream', 1, 'tub']],
      steps: ['Drain the chicken and stir in the taco seasoning with a splash of water.', 'Sprinkle cheese and chicken on half a tortilla and fold.', 'Cook on a medium griddle until crisp and melted, about 2 minutes per side.', 'Cut into wedges; serve with salsa and sour cream.'] },
    { id: 'r-spaghetti', title: 'Spaghetti with meat sauce', meal: 'dinner', method: 'Stove', serves: 8,
      ingredients: [['Spaghetti', 2, 'lb'], ['Ground beef', 2, 'lb'], ['Pasta sauce', 2, 'jar'], ['Onion', 1, 'each'], ['Garlic bread (frozen)', 1, 'each'], ['Bagged salad', 2, 'bag'], ['Parmesan', 1, 'each']],
      steps: ['Boil a big pot of salted water for the pasta.', 'Brown the beef with chopped onion until no pink remains (160°F); drain.', 'Add the sauce and simmer 10 minutes.', 'Cook spaghetti 9–11 minutes, drain away from people, and toss with a little sauce.', 'Warm the garlic bread in foil near the coals.'] },
    { id: 'r-jambalaya', title: 'One-pot chicken & sausage jambalaya', meal: 'dinner', method: 'Stove', serves: 8,
      ingredients: [['Smoked sausage', 1.5, 'lb'], ['Boneless chicken thighs', 2, 'lb'], ['Long-grain rice', 3, 'cups'], ['Chicken broth', 6, 'cups'], ['Diced tomatoes', 1, 'can'], ['Onion', 1, 'each'], ['Bell pepper', 1, 'each'], ['Cajun seasoning', 2, 'tbsp'], ['Cooking oil', 2, 'tbsp']],
      steps: ['Slice sausage and cube chicken; keep raw chicken on its own cutting board.', 'Brown sausage and chicken in oil in a big pot.', 'Add onion and pepper and cook until soft.', 'Stir in rice, broth, tomatoes and seasoning. Bring to a boil, cover, and simmer low 20 minutes without lifting the lid.', 'Check the chicken reaches 165°F, fluff and serve.'] },
    { id: 'r-dolasagna', title: 'Dutch oven lasagna', meal: 'dinner', method: 'Dutch oven', serves: 10,
      ingredients: [['Ground beef or Italian sausage', 2, 'lb'], ['Pasta sauce', 2, 'jar'], ['Oven-ready lasagna noodles', 1, 'box'], ['Ricotta', 2, 'lb'], ['Shredded mozzarella', 4, 'cups'], ['Eggs', 2, 'each'], ['Italian seasoning', 1, 'tbsp'], ['Dutch oven liner', 1, 'each']],
      steps: ['Brown the meat (160°F), drain, and stir in the sauce.', 'Mix ricotta, eggs and seasoning.', 'In a lined 12" dutch oven layer sauce, noodles (break to fit), ricotta, mozzarella. Repeat three times, ending with sauce and cheese.', 'Bake with about 8 coals below and 17 on top for 45–60 minutes, rotating every 15 minutes.', 'Rest 10 minutes before cutting.'] },
    { id: 'r-fajitas', title: 'Chicken fajitas', meal: 'dinner', method: 'Griddle', serves: 8,
      ingredients: [['Boneless chicken breast', 3, 'lb'], ['Bell peppers', 4, 'each'], ['Onions', 2, 'each'], ['Fajita seasoning', 2, 'packet'], ['Flour tortillas', 20, 'each'], ['Shredded cheese', 2, 'cups'], ['Sour cream', 1, 'tub'], ['Salsa', 1, 'jar'], ['Cooking oil', 3, 'tbsp']],
      steps: ['Slice chicken into strips on its own board; wash hands and knife after.', 'Toss chicken with oil and half the seasoning; cook on a hot griddle until 165°F inside.', 'Cook sliced peppers and onions with the rest of the seasoning until soft and charred.', 'Warm tortillas and build at the table.'] },
    { id: 'r-potpie', title: 'Dutch oven chicken pot pie', meal: 'dinner', method: 'Dutch oven', serves: 10,
      ingredients: [['Canned chicken', 4, 'can'], ['Frozen mixed vegetables', 2, 'lb'], ['Cream of chicken soup', 3, 'can'], ['Milk', 1, 'cups'], ['Canned biscuits', 2, 'can'], ['Black pepper', 1, 'tsp'], ['Dutch oven liner', 1, 'each']],
      steps: ['Stir chicken, vegetables, soup, milk and pepper together in a lined 12" dutch oven.', 'Heat over coals until bubbling, about 15 minutes.', 'Lay biscuits over the top.', 'Bake with about 8 coals below and 16 on top for 15–20 minutes until the biscuits are golden.'] },
    { id: 'r-hotdogsbeans', title: 'Hot dogs & campfire beans', meal: 'dinner', method: 'Campfire', serves: 8,
      ingredients: [['Hot dogs', 16, 'each'], ['Hot dog buns', 16, 'each'], ['Baked beans', 3, 'can'], ['Bacon', 0.5, 'lb'], ['Brown sugar', 0.25, 'cups'], ['Ketchup & mustard', 1, 'set'], ['Roasting sticks', 8, 'each']],
      steps: ['Cook chopped bacon in a pot, then add beans and brown sugar and simmer at the edge of the fire.', 'Roast hot dogs over coals until hot all the way through (165°F).', 'Toast buns at the edge of the grate.'] },
    { id: 'r-dumpcake', title: 'Cherry chocolate dump cake', meal: 'dessert', method: 'Dutch oven', serves: 12,
      ingredients: [['Cherry pie filling', 2, 'can'], ['Chocolate cake mix', 1, 'box'], ['Lemon-lime soda', 12, 'oz'], ['Chocolate chips', 1, 'cups'], ['Dutch oven liner', 1, 'each']],
      steps: ['Spread pie filling in a lined 12" dutch oven.', 'Sprinkle dry cake mix evenly over it and slowly pour the soda over the mix. Do not stir.', 'Top with chocolate chips.', 'Bake with about 8 coals below and 16 on top for 40–45 minutes.'] },
    { id: 'r-bananaboats', title: 'Banana boats', meal: 'dessert', method: 'Coals', serves: 8,
      ingredients: [['Bananas', 8, 'each'], ['Mini marshmallows', 1, 'bag'], ['Chocolate chips', 1, 'cups'], ['Heavy-duty foil', 1, 'roll']],
      steps: ['Slit each banana lengthwise through the top peel, not all the way through.', 'Open it a little and stuff with marshmallows and chips.', 'Wrap in foil and set on the coals 5–8 minutes.', 'Eat with a spoon right out of the peel.'] },
    { id: 'r-cinnrolls', title: 'Dutch oven cinnamon rolls', meal: 'dessert', method: 'Dutch oven', serves: 10,
      ingredients: [['Canned cinnamon rolls', 2, 'can'], ['Butter', 2, 'tbsp'], ['Dutch oven liner', 1, 'each']],
      steps: ['Butter a lined 12" dutch oven and arrange the rolls with a little space between.', 'Bake with about 7 coals below and 17 on top for 15–20 minutes, rotating halfway.', 'Spread the icing while they are warm. Great for Sunday morning, too.'] },
    { id: 'r-trailmix', title: 'Make-your-own trail mix', meal: 'snack', method: 'No cook', serves: 10,
      ingredients: [['Peanuts or mixed nuts', 2, 'lb'], ['Raisins', 1, 'lb'], ['M&M\'s', 1, 'lb'], ['Pretzels', 1, 'bag'], ['Cereal squares', 1, 'box'], ['Snack bags', 10, 'each']],
      steps: ['Set the bowls out in a line and let each scout fill a bag.', 'Check for nut allergies first and make a nut-free bowl if needed.'] },
    { id: 'r-cocoa', title: 'Campfire hot cocoa', meal: 'drink', method: 'Stove', serves: 10,
      ingredients: [['Hot cocoa mix', 1, 'can'], ['Water', 2.5, 'gal'], ['Mini marshmallows', 1, 'bag'], ['Peppermint sticks (optional)', 10, 'each']],
      steps: ['Bring a big pot of water to just under a boil.', 'Ladle into mugs (adults pour for younger scouts) and stir in cocoa mix per the can.', 'Top with marshmallows.'] },
  ],
};

export default troop;
