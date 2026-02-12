"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiResponse } from "@/types";

export default function SignUp() {
  const [formData, setFormData] = useState({
    schoolName: "",
    schoolAddress: "",
    schoolPhone: "",
    schoolEmail: "",
    adminName: "",
    adminPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate passwords match
    if (formData.adminPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Validate password length
    if (formData.adminPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/schools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.schoolName,
          address: formData.schoolAddress,
          phone: formData.schoolPhone,
          email: formData.schoolEmail,
          adminName: formData.adminName,
          adminEmail: formData.schoolEmail, // Use school email as admin login
          adminPassword: formData.adminPassword,
        }),
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        // Redirect to signin page with success message
        router.push(
          "/auth/signin?message=School created successfully. Please sign in.",
        );
      } else {
        setError(data.error || "Failed to create school");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className='max-w-md w-full space-y-8'>
      <div>
        <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>
          Create Your School Account
        </h2>
        <p className='mt-2 text-center text-sm text-gray-600'>
          Register your school and create an admin account to get started
        </p>
      </div>

      <form className='mt-8 space-y-6' onSubmit={handleSubmit}>
        {/* School Information */}
        <div className='space-y-4'>
          <h3 className='text-lg font-medium text-gray-900'>
            School Information
          </h3>

          <div>
            <label
              htmlFor='schoolName'
              className='block text-sm font-medium text-gray-700'
            >
              School Name *
            </label>
            <input
              id='schoolName'
              name='schoolName'
              type='text'
              required
              className='mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
              placeholder='Enter school name'
              value={formData.schoolName}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label
              htmlFor='schoolAddress'
              className='block text-sm font-medium text-gray-700'
            >
              School Address
            </label>
            <input
              id='schoolAddress'
              name='schoolAddress'
              type='text'
              className='mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
              placeholder='Enter school address'
              value={formData.schoolAddress}
              onChange={handleInputChange}
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='schoolPhone'
                className='block text-sm font-medium text-gray-700'
              >
                Phone Number
              </label>
              <input
                id='schoolPhone'
                name='schoolPhone'
                type='tel'
                className='mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                placeholder='Phone number'
                value={formData.schoolPhone}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label
                htmlFor='schoolEmail'
                className='block text-sm font-medium text-gray-700'
              >
                School Email
              </label>
              <input
                id='schoolEmail'
                name='schoolEmail'
                type='email'
                className='mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                placeholder='school@example.com'
                value={formData.schoolEmail}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Admin Information */}
        <div className='space-y-4'>
          <h3 className='text-lg font-medium text-gray-900'>Admin Account</h3>

          <div>
            <label
              htmlFor='adminName'
              className='block text-sm font-medium text-gray-700'
            >
              Admin Name *
            </label>
            <input
              id='adminName'
              name='adminName'
              type='text'
              required
              className='mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
              placeholder='Enter admin full name'
              value={formData.adminName}
              onChange={handleInputChange}
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='adminPassword'
                className='block text-sm font-medium text-gray-700'
              >
                Admin Password *
              </label>
              <input
                id='adminPassword'
                name='adminPassword'
                type='password'
                required
                className='mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                placeholder='Minimum 6 characters'
                value={formData.adminPassword}
                onChange={handleInputChange}
              />
              <p className='mt-1 text-xs text-gray-500'>
                You will use the school email and this password to sign in as
                the admin.
              </p>
            </div>

            <div>
              <label
                htmlFor='confirmPassword'
                className='block text-sm font-medium text-gray-700'
              >
                Confirm Password *
              </label>
              <input
                id='confirmPassword'
                name='confirmPassword'
                type='password'
                required
                className='mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                placeholder='Confirm password'
                value={formData.confirmPassword}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className='text-red-600 text-sm text-center bg-red-50 p-3 rounded-md'>
            {error}
          </div>
        )}

        <div>
          <button
            type='submit'
            disabled={loading}
            className='group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading ? "Creating School..." : "Create School Account"}
          </button>
        </div>

        <div className='text-center'>
          <p className='text-sm text-gray-600'>
            Already have an account?{" "}
            <Link
              href='/auth/signin'
              className='font-medium text-blue-600 hover:text-blue-500'
            >
              Sign in here
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
