import { route } from "@react-router/dev/routes"

export default [
	// Lens Library - Browse all available lenses and configure settings
	route("lenses", "./features/lenses/pages/library.tsx"),
	// Aggregated Lens Views - Project-wide lens analysis
	route("lenses/sales-bant", "./features/lenses/pages/aggregated-sales-bant.tsx"),
	route("lenses/customer-discovery", "./features/lenses/pages/aggregated-customer-discovery.tsx"),
	// Product Lens - Pain × User Type Matrix
	route("product-lens", "./features/lenses/pages/product-lens.tsx"),
	// BANT Lens - Budget × Authority Matrix (legacy, uses opportunities)
	route("bant-lens", "./features/lenses/pages/bant-lens.tsx"),
]
