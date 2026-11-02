using DataApi.Models;
using Microsoft.EntityFrameworkCore;

namespace DataApi.Data;

/// <summary>
/// EF Core "DbContext" = the connection between our C# classes and the database.
/// Each DbSet becomes a table.
/// </summary>
public class DataDbContext : DbContext
{
    public DataDbContext(DbContextOptions<DataDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ----- Users -----
        // Username: required, max 50 characters, and UNIQUE (no duplicate usernames)
        modelBuilder.Entity<User>()
            .Property(u => u.Username)
            .HasMaxLength(50)
            .IsRequired();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        // ----- Products -----
        modelBuilder.Entity<Product>()
            .Property(p => p.Name)
            .HasMaxLength(100)
            .IsRequired();

        modelBuilder.Entity<Product>()
            .Property(p => p.Category)
            .HasMaxLength(50)
            .IsRequired();

        modelBuilder.Entity<Product>()
            .Property(p => p.ImageUrl)
            .HasMaxLength(200);

        // Money: 10 digits in total, 2 after the decimal point (e.g. 12345678.99)
        modelBuilder.Entity<Product>()
            .Property(p => p.Price)
            .HasPrecision(10, 2);

        // ----- Orders -----
        // OrderNumber: required and UNIQUE (two orders never share a number)
        modelBuilder.Entity<Order>()
            .Property(o => o.OrderNumber)
            .HasMaxLength(30)
            .IsRequired();

        modelBuilder.Entity<Order>()
            .HasIndex(o => o.OrderNumber)
            .IsUnique();

        modelBuilder.Entity<Order>()
            .Property(o => o.Username)
            .HasMaxLength(50)
            .IsRequired();

        modelBuilder.Entity<Order>()
            .Property(o => o.Status)
            .HasMaxLength(20)
            .IsRequired();

        // Money: DECIMAL(10,2), same as Products.Price
        modelBuilder.Entity<Order>().Property(o => o.Subtotal).HasPrecision(10, 2);
        modelBuilder.Entity<Order>().Property(o => o.Delivery).HasPrecision(10, 2);
        modelBuilder.Entity<Order>().Property(o => o.Total).HasPrecision(10, 2);

        // One order has many items. Deleting an order deletes its items too.
        modelBuilder.Entity<Order>()
            .HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // ----- OrderItems -----
        modelBuilder.Entity<OrderItem>()
            .Property(i => i.ProductName)
            .HasMaxLength(100)
            .IsRequired();

        modelBuilder.Entity<OrderItem>().Property(i => i.UnitPrice).HasPrecision(10, 2);
        modelBuilder.Entity<OrderItem>().Property(i => i.LineTotal).HasPrecision(10, 2);
    }
}
