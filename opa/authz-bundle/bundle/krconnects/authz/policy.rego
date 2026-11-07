# Example API authorization policy for KRConnects (OPA, Rego v1 syntax).
# input = the API request (JSON): method, path and the user from the JWT.
# data.krconnects.authz = the values from data.json in this folder.
package krconnects.authz

# Deny everything unless a rule below says allow ("deny by default")
default allow := false

# Rule 1: anyone may read public paths (shop products, health checks)
allow if {
	input.method == "GET"
	input.path == data.krconnects.authz.public_paths[_]
}

# Rule 2: only admins may call admin paths
allow if {
	input.path == data.krconnects.authz.admin_paths[_]
	input.user.role == "admin"
}

# Rule 3: a logged-in customer may read ONLY their own orders: /orders/<their user id>
# (business rule Istio AuthorizationPolicy cannot express: it compares the path with the user)
allow if {
	input.method == "GET"
	input.path == concat("/", ["", "orders", input.user.id])
}

# Extra: a reason for the decision (useful in logs)
reason := "allowed" if allow
reason := "denied: no rule allows this request" if not allow
