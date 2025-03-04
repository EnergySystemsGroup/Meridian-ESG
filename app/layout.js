import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './components/theme-provider';

const inter = Inter({
	subsets: ['latin'],
	variable: '--font-inter',
	display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
	subsets: ['latin'],
	variable: '--font-jetbrains-mono',
	display: 'swap',
});

export const metadata = {
	title: 'Policy & Funding Intelligence',
	description: 'Track and analyze funding opportunities and legislation',
};

export default function RootLayout({ children }) {
	return (
		<html lang='en' className={`${inter.variable} ${jetbrainsMono.variable}`}>
			<body className='antialiased min-h-screen bg-white dark:bg-neutral-950'>
				<ThemeProvider>{children}</ThemeProvider>
			</body>
		</html>
	);
}
