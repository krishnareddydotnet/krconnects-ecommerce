using System.ComponentModel.DataAnnotations;

namespace DataApi.Models;

// -----------------------------------------------------------------------
// Request body for POST /orders (sent by order-api, not by the browser).
// order-api already checked the products and calculated the totals; these
// attributes are a second safety net. Invalid input returns 400 automatically.
// -----------------------------------------------------------------------

public class CreateOrderRequest
{
    [Required]
    [StringLength(30, MinimumLength = 5)]
    public string OrderNumber { get; set; } = "";

    [Range(1, int.MaxValue)]
    public int UserId { get; set; }

    [Required]
    [StringLength(50, MinimumLength = 1)]
    public string Username { get; set; } = "";

    [Required]
    [StringLength(20, MinimumLength = 1)]
    public string Status { get; set; } = "";

    [Range(typeof(decimal), "0", "99999999")]
    public decimal Subtotal { get; set; }

    [Range(typeof(decimal), "0", "99999999")]
    public decimal Delivery { get; set; }

    [Range(typeof(decimal), "0", "99999999")]
    public decimal Total { get; set; }

    [Required]
    [MinLength(1)]
    public List<CreateOrderItemRequest> Items { get; set; } = new();
}

public class CreateOrderItemRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string ProductName { get; set; } = "";

    [Range(typeof(decimal), "0", "10000000")]
    public decimal UnitPrice { get; set; }

    [Range(1, 10)]
    public int Quantity { get; set; }

    [Range(typeof(decimal), "0", "99999999")]
    public decimal LineTotal { get; set; }
}
