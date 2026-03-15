export default function BrandMark() {
    return (
        <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="threadBlue" x1="10" y1="14" x2="42" y2="20" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#3158D5" />
                    <stop offset="1" stopColor="#5C7CFA" />
                </linearGradient>
                <linearGradient id="threadAmber" x1="10" y1="24" x2="42" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#D97706" />
                    <stop offset="1" stopColor="#F59E0B" />
                </linearGradient>
                <linearGradient id="threadCoral" x1="10" y1="33" x2="42" y2="38" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#DC2626" />
                    <stop offset="1" stopColor="#F97316" />
                </linearGradient>
            </defs>

            <path d="M14 9.5V42.5" stroke="#D7DFEA" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M20 9.5V42.5" stroke="#C8D3E4" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M26 9.5V42.5" stroke="#B9C7DB" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M32 9.5V42.5" stroke="#C8D3E4" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M38 9.5V42.5" stroke="#D7DFEA" strokeWidth="2.4" strokeLinecap="round" />

            <path
                d="M10 16C13.2 16 14.4 13.2 17.8 13.2C21.2 13.2 22 18.8 26 18.8C30 18.8 30.8 13.2 34.2 13.2C37.6 13.2 38.8 16 42 16"
                stroke="url(#threadBlue)"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M10 25.5C13.2 25.5 14.6 28.6 18 28.6C21.4 28.6 22 22.4 26 22.4C30 22.4 30.6 28.6 34 28.6C37.4 28.6 38.8 25.5 42 25.5"
                stroke="url(#threadAmber)"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M10 35C13.2 35 14.4 32.2 17.8 32.2C21.2 32.2 22 37.8 26 37.8C30 37.8 30.8 32.2 34.2 32.2C37.6 32.2 38.8 35 42 35"
                stroke="url(#threadCoral)"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            <path
                d="M10 16C13.2 16 14.4 13.2 17.8 13.2C21.2 13.2 22 18.8 26 18.8C30 18.8 30.8 13.2 34.2 13.2C37.6 13.2 38.8 16 42 16"
                stroke="#FFFFFF"
                strokeOpacity="0.32"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M10 25.5C13.2 25.5 14.6 28.6 18 28.6C21.4 28.6 22 22.4 26 22.4C30 22.4 30.6 28.6 34 28.6C37.4 28.6 38.8 25.5 42 25.5"
                stroke="#FFF7ED"
                strokeOpacity="0.42"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M10 35C13.2 35 14.4 32.2 17.8 32.2C21.2 32.2 22 37.8 26 37.8C30 37.8 30.8 32.2 34.2 32.2C37.6 32.2 38.8 35 42 35"
                stroke="#FFF7ED"
                strokeOpacity="0.28"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
