# Unit tests: run with  opa test bundle/ -v   (from opa/authz-bundle/)
# Same package as the policy, so the tests can use "allow" directly.
# "with input as {...}" replaces the input for one test (a fake API request).
package krconnects.authz

test_public_products_allowed if {
	allow with input as {"method": "GET", "path": "/products", "user": {}}
}

test_admin_can_open_admin_orders if {
	allow with input as {"method": "GET", "path": "/admin/orders", "user": {"id": "u1", "role": "admin"}}
}

test_customer_cannot_open_admin_orders if {
	not allow with input as {"method": "GET", "path": "/admin/orders", "user": {"id": "u2", "role": "customer"}}
}

test_customer_can_read_own_orders if {
	allow with input as {"method": "GET", "path": "/orders/u2", "user": {"id": "u2", "role": "customer"}}
}

test_customer_cannot_read_other_orders if {
	not allow with input as {"method": "GET", "path": "/orders/u3", "user": {"id": "u2", "role": "customer"}}
}
