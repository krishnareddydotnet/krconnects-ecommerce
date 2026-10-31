namespace DataApi.Models;

/// <summary>
/// One row in the "OrderItems" table = one product in an order.
/// ProductName and UnitPrice are COPIED at order time, so the order still
/// shows what the customer paid even if the product's price changes later.
/// </summary>
public class OrderItem
{
    public int Id { get; set; }                       // primary key (auto number)
    public int OrderId { get; set; }                  // foreign key -> Orders.Id
    public int ProductId { get; set; }
    public string ProductName { get; set; } = "";
    public decimal UnitPrice { get; set; }            // price of ONE item at order time
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }            // UnitPrice x Quantity

    // No "Order" navigation property here on purpose: it would make a loop
    // (Order -> Items -> Order -> ...) when the order is turned into JSON.
}
