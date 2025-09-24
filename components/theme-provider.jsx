'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
	theme: 'light',
	setTheme: () => null,
});

export function ThemeProvider({ children }) {
	const [theme, setTheme] = useState('light');

	useEffect(() => {
		const storedTheme = localStorage.getItem('theme') || 'light';
		setTheme(storedTheme);

		if (storedTheme === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}, []);

	const value = {
		theme,
		setTheme: (newTheme) => {
			localStorage.setItem('theme', newTheme);
			setTheme(newTheme);

			if (newTheme === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		},
	};

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export const useTheme = () => useContext(ThemeContext);
