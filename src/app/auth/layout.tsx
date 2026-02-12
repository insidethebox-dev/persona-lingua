import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='min-h-screen flex flex-col bg-gray-50'>
      {/* Main content area — centered */}
      <div className='flex-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8'>
        {/* Logo */}
        <div className='mb-6'>
          <Image
            src='/persona-lingua-logo-blue.svg'
            alt='PersonaLingua'
            width={180}
            height={220}
            priority
          />
        </div>

        {/* Page content (sign-in / sign-up form) */}
        {children}
      </div>

      {/* EU Disclaimer Footer */}
      <footer className='w-full border-t border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8'>
        <div className='max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4'>
          <p className='text-xs text-gray-500 leading-relaxed flex-1'>
            Funded by the European Union. Views and opinions expressed are
            however those of the author(s) only and do not necessarily reflect
            those of the European Union or the European Education and Culture
            Executive Agency (EACEA). Neither the European Union nor EACEA can
            be held responsible for them.
          </p>
          {/* Replace /eu-flag.png with your actual image path */}
          <div className='flex-shrink-0'>
            <Image
              src='/eu-banner.png'
              alt='Co-funded by the European Union'
              width={200}
              height={60}
              className='h-auto w-auto max-h-[60px]'
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
