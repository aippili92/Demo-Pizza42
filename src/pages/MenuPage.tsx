import { PIZZA_MENU } from "../data/menu";

const MenuPage = () => {
  return (
    <div className="menu-page">
      <h1>Our Menu</h1>
      <p className="menu-subtitle">Choose from our selection of handcrafted pizzas</p>

      <div className="menu-grid">
        {PIZZA_MENU.map((pizza) => (
          <div key={pizza.id} className="menu-card">
            <span className="pizza-emoji">{pizza.emoji}</span>
            <h3>{pizza.name}</h3>
            <p className="pizza-description">{pizza.description}</p>
            <div className="pizza-toppings">
              {pizza.toppings.map((topping, index) => (
                <span key={index} className="topping-badge">
                  {topping}
                </span>
              ))}
            </div>
            <p className="pizza-price">${pizza.price.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MenuPage;
