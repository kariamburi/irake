'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Cropper from 'react-easy-crop';

import { db, auth, storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Slider } from '@/components/ui/slider';
import getCroppedImg from '@/utils/cropImage';
import { getAuth } from 'firebase/auth';
import { CameraIcon } from 'lucide-react';

interface Props {
  onImageSaved?: (url: string) => void;
  onStartCrop: () => void;

}

export default function ProfileImageCropper({ onImageSaved, onStartCrop }: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const auth = getAuth();
  const user = auth.currentUser;

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleUpload = async () => {

    if (!imageSrc || !croppedAreaPixels || !user) return;
    setIsUploading(true);
    try {

      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);

      const imageRef = ref(storage, `profileImages/${user.uid}`);
      await uploadString(imageRef, croppedImage, 'data_url');

      const url = await getDownloadURL(imageRef);

      await setDoc(
        doc(db, 'users', user.uid),
        {
          photoUrl: url,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      onImageSaved?.(url);
      setImageSrc(null);
    } catch (error) {
      console.error('Error uploading cropped image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => { setImageSrc(reader.result as string); onStartCrop(); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4 items-center w-full max-w-md mx-auto">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Centered Choose Image button */}
      <div className="flex justify-center">
        <Button type="button" onClick={() => inputRef.current?.click()}>
          <CameraIcon className="w-5 h-5" />
          Choose Image
        </Button>
      </div>

      {imageSrc && (
        <>
          {/* Cropper Area */}
          <div className="relative w-full h-[350px] sm:h-[400px] bg-gray-200 rounded-md overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Slider and Save Button */}
          <div className="space-y-2">
            <Slider
              min={1}
              max={3}
              step={0.1}
              value={[zoom]}
              onValueChange={([val]) => setZoom(val)}
            />
            <Button
              type="button"
              className="mt-2 w-full"
              disabled={isUploading}
              onClick={handleUpload}
            >
              {isUploading ? 'Uploading...' : 'Save Profile Picture'}
            </Button>
          </div>
        </>
      )}
    </div>

  );
}
