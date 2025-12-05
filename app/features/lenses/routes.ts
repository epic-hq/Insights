import { route } from "@react-router/dev/routes"

export default [
	// Lens Library - Browse all available lenses
	route("lenses", "./features/lenses/pages/library.tsx"),
	// Product Lens - Pain × User Type Matrix
	route("product-lens", "./features/lenses/pages/product-lens.tsx"),
	// BANT Lens - Budget × Authority Matrix
	route("bant-lens", "./features/lenses/pages/bant-lens.tsx"),
]
