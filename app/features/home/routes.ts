import { route } from "@react-router/dev/routes";

export default [
	route("home", "./features/home/pages/account-overview.tsx"),
	route("profile", "./features/users/pages/profile.tsx"),
	route("my-responses", "./features/home/pages/my-responses.tsx"),
];
