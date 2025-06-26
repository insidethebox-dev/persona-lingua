"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { Camera, Save, Trash2, AlertTriangle } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  profilePicture: string | null;
  publicId: string | null;
  isSchoolAdmin: boolean;
  schoolName?: string;
  subject?: string;
  bio?: string;
}

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    bio: "",
  });

  useEffect(() => {
    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/profile");
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setFormData({
          name: data.name || "",
          subject: data.subject || "",
          bio: data.bio || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload-profile-picture", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                profilePicture: data.profilePicture,
                publicId: data.publicId,
              }
            : null
        );

        // Update session
        await update({
          ...session,
          user: {
            ...session?.user,
            profilePicture: data.profilePicture,
          },
        });

        toast.success("Profile picture updated successfully");
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to upload image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);

        // Update session
        await update({
          ...session,
          user: {
            ...session?.user,
            name: updatedProfile.name,
          },
        });

        toast.success("Profile updated successfully");
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/profile", {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Account deleted successfully");
        await signOut({ callbackUrl: "/" });
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to delete account");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className='flex items-center justify-center min-h-screen w-full'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className='flex items-center justify-center min-h-screen w-full'>
          <div className='text-center'>
            <h2 className='text-xl font-semibold text-gray-900 mb-2'>
              Profile not found
            </h2>
            <p className='text-gray-600'>
              Unable to load your profile information.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className='w-full min-h-screen p-8 bg-white'>
        <Toaster position='top-right' />
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-900'>Settings</h1>
          <p className='text-gray-600'>
            Manage your profile information and account settings
          </p>
        </div>

        {/* Profile Picture Section */}
        <div className='mb-8'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>
            Profile Picture
          </h2>
          <div className='flex items-center space-x-6'>
            <div className='relative'>
              <div className='w-24 h-24 rounded-full overflow-hidden bg-gray-200'>
                {profile.profilePicture ? (
                  <Image
                    src={profile.profilePicture}
                    alt='Profile picture'
                    width={96}
                    height={96}
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <div className='w-full h-full flex items-center justify-center text-gray-400'>
                    <Camera className='w-8 h-8' />
                  </div>
                )}
              </div>
              <label
                htmlFor='profile-picture'
                className='absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors'
              >
                <Camera className='w-4 h-4' />
              </label>
              <input
                id='profile-picture'
                type='file'
                accept='image/*'
                onChange={handleImageUpload}
                className='hidden'
                disabled={uploadingImage}
              />
            </div>
            <div>
              <p className='text-sm text-gray-600 mb-2'>
                Click the camera icon to upload a new profile picture
              </p>
              <p className='text-xs text-gray-500'>
                Supported formats: JPG, PNG, GIF (max 5MB)
              </p>
              {uploadingImage && (
                <p className='text-xs text-blue-600 mt-1'>Uploading...</p>
              )}
            </div>
          </div>
        </div>

        {/* Profile Information */}
        <div className='mb-8'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>
            Profile Information
          </h2>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Name
              </label>
              <input
                type='text'
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='Enter your name'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Email
              </label>
              <input
                type='email'
                value={profile.email}
                disabled
                className='w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed'
              />
              <p className='text-xs text-gray-500 mt-1'>
                Email cannot be changed
              </p>
            </div>

            {!profile.isSchoolAdmin && (
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Subject
                </label>
                <input
                  type='text'
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='e.g., Mathematics, English'
                />
              </div>
            )}

            {profile.isSchoolAdmin && (
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  School
                </label>
                <input
                  type='text'
                  value={profile.schoolName || ""}
                  disabled
                  className='w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed'
                />
              </div>
            )}
          </div>

          <div className='mt-6'>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
              rows={4}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Tell us about yourself...'
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className='flex justify-between items-center pt-6 border-t'>
          <button
            onClick={() => setShowDeleteModal(true)}
            className='flex items-center px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors'
          >
            <Trash2 className='w-4 h-4 mr-2' />
            Delete Account
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className='flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50'
          >
            <Save className='w-4 h-4 mr-2' />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 max-w-md w-full mx-4'>
            <div className='flex items-center mb-4'>
              <AlertTriangle className='w-6 h-6 text-red-600 mr-3' />
              <h3 className='text-lg font-semibold text-gray-900'>
                Delete Account
              </h3>
            </div>
            <p className='text-gray-600 mb-6'>
              Are you sure you want to delete your account? This action cannot
              be undone.
              {profile.isSchoolAdmin && (
                <span className='block mt-2 text-sm text-amber-600'>
                  <strong>Warning:</strong> As a school admin, deleting your
                  account will transfer all teachers to become independent
                  users.
                </span>
              )}
            </p>
            <div className='flex justify-end space-x-3'>
              <button
                onClick={() => setShowDeleteModal(false)}
                className='px-4 py-2 text-gray-600 hover:text-gray-700'
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50'
              >
                {isDeleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
