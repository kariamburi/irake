"use client";

import { useState } from "react";
import { updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Image from "next/image";

interface ProfileEditorProps {
    user: any;
    userData: any;
    onClose: () => void;
    onSave: (updatedData: any) => void;
}

const ProfileEditor = ({ user, userData, onClose, onSave }: ProfileEditorProps) => {
    const [formData, setFormData] = useState({
        displayName: userData.displayName || "",
        bio: userData.bio || "",
        gender: userData.gender || "",
        preference: userData.preference || "",
        dob: userData.dob || "",
        profileImage: userData.photoUrl || "",
    });

    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageUpload = async () => {
        if (!selectedImage) return formData.profileImage;

        const imageRef = ref(storage, `users/${user.uid}/profile.jpg`);
        await uploadBytes(imageRef, selectedImage);
        const downloadURL = await getDownloadURL(imageRef);
        return downloadURL;
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const imageUrl = await handleImageUpload();

            const userRef = doc(db, "users", user.uid);
            const updatedData = {
                ...formData,
                profileImage: imageUrl,
            };

            await updateDoc(userRef, updatedData);
            onSave(updatedData);
            onClose();
        } catch (error) {
            console.error("Error saving profile:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-xl font-semibold mb-4">Edit Profile</h2>

                {/* Image */}
                <div className="flex flex-col items-center mb-4">
                    {selectedImage ? (
                        <Image
                            src={URL.createObjectURL(selectedImage)}
                            alt="Preview"
                            width={100}
                            height={100}
                            className="rounded-full object-cover"
                        />
                    ) : formData.profileImage ? (
                        <img
                            src={formData.profileImage}
                            alt="Current"
                            width={100}
                            height={100}
                            className="rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-gray-200" />
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={e => setSelectedImage(e.target.files?.[0] || null)}
                        className="mt-2 text-sm"
                    />
                </div>

                {/* Form */}
                <div className="space-y-3">
                    <input
                        type="text"
                        name="displayName"
                        value={formData.displayName}
                        onChange={handleChange}
                        placeholder="Display Name"
                        className="w-full border px-3 py-2 rounded"
                    />
                    <textarea
                        name="bio"
                        value={formData.bio}
                        onChange={handleChange}
                        placeholder="Bio"
                        rows={3}
                        className="w-full border px-3 py-2 rounded"
                    />
                    <input
                        type="date"
                        name="dob"
                        value={formData.dob}
                        onChange={handleChange}
                        className="w-full border px-3 py-2 rounded"
                    />
                    <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className="w-full border px-3 py-2 rounded"
                    >
                        <option value="">Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="nonbinary">Non-binary</option>
                    </select>
                    <select
                        name="preference"
                        value={formData.preference}
                        onChange={handleChange}
                        className="w-full border px-3 py-2 rounded"
                    >
                        <option value="">Interested In</option>
                        <option value="men">Men</option>
                        <option value="women">Women</option>
                        <option value="everyone">Everyone</option>
                    </select>
                </div>

                {/* Actions */}
                <div className="flex justify-end mt-6 gap-4">
                    <button onClick={onClose} className="text-gray-600 hover:text-black">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700"
                    >
                        {loading ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileEditor;
