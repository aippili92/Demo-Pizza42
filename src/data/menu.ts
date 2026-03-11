export interface Pizza {
  id: string;
  name: string;
  description: string;
  toppings: string[];
  price: number;
  emoji: string;
}

export interface PizzaSize {
  id: string;
  name: string;
  priceMultiplier: number;
}

export interface ExtraTopping {
  id: string;
  name: string;
  price: number;
}

export const PIZZA_MENU: Pizza[] = [
  {
    id: "margherita",
    name: "Margherita",
    description: "Classic tomato sauce, fresh mozzarella, basil",
    toppings: ["Tomato Sauce", "Fresh Mozzarella", "Basil"],
    price: 14.42,
    emoji: "🍕",
  },
  {
    id: "pepperoni",
    name: "Pepperoni",
    description: "Tomato sauce, mozzarella, spicy pepperoni",
    toppings: ["Tomato Sauce", "Mozzarella", "Pepperoni"],
    price: 16.42,
    emoji: "🔴",
  },
  {
    id: "hawaiian",
    name: "Hawaiian",
    description: "Ham, pineapple, mozzarella on tomato base",
    toppings: ["Tomato Sauce", "Mozzarella", "Ham", "Pineapple"],
    price: 17.42,
    emoji: "🍍",
  },
  {
    id: "veggie",
    name: "Veggie Supreme",
    description: "Bell peppers, mushrooms, onions, olives, tomatoes",
    toppings: ["Tomato Sauce", "Mozzarella", "Bell Peppers", "Mushrooms", "Onions", "Olives"],
    price: 18.42,
    emoji: "🥬",
  },
  {
    id: "bbq-chicken",
    name: "BBQ Chicken",
    description: "BBQ sauce, grilled chicken, red onions, cilantro",
    toppings: ["BBQ Sauce", "Mozzarella", "Grilled Chicken", "Red Onions", "Cilantro"],
    price: 19.42,
    emoji: "🍗",
  },
  {
    id: "meat-lovers",
    name: "Meat Lovers",
    description: "Pepperoni, sausage, bacon, ham, ground beef",
    toppings: ["Tomato Sauce", "Mozzarella", "Pepperoni", "Sausage", "Bacon", "Ham", "Ground Beef"],
    price: 21.42,
    emoji: "🥓",
  },
];

export const PIZZA_SIZES: PizzaSize[] = [
  { id: "small", name: '12" Small', priceMultiplier: 1.0 },
  { id: "large", name: '16" Large', priceMultiplier: 1.4 },
];

export const EXTRA_TOPPINGS: ExtraTopping[] = [
  { id: "extra-cheese", name: "Extra Cheese", price: 2.0 },
  { id: "mushrooms", name: "Mushrooms", price: 1.5 },
  { id: "jalapenos", name: "Jalapenos", price: 1.0 },
  { id: "olives", name: "Olives", price: 1.5 },
  { id: "bacon", name: "Bacon", price: 2.5 },
];
