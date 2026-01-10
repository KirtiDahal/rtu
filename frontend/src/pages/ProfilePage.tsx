import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed);
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("");
  const [avgCycleLength, setAvgCycleLength] = useState("");
  const [notes, setNotes] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [accountMessage, setAccountMessage] = useState("");
  const [accountError, setAccountError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [avatarPreviewErrored, setAvatarPreviewErrored] = useState(false);
  const minDateOfBirth = "1900-01-01";
  const maxDateOfBirth = new Date().toISOString().slice(0, 10);

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.profile.get()
  });

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }
    setDisplayName(profileQuery.data.user.displayName ?? "");
    setAvatarUrl(profileQuery.data.user.avatarUrl ?? "");
    setDateOfBirth(profileQuery.data.profile.dateOfBirth ?? "");
    setAge(profileQuery.data.profile.age?.toString() ?? "");
    setLocation(profileQuery.data.profile.location ?? "");
    setTimezone(profileQuery.data.profile.timezone ?? "");
    setAvgCycleLength(profileQuery.data.profile.avgCycleLength?.toString() ?? "");
    setNotes(profileQuery.data.profile.notes ?? "");
    setAvatarPreviewErrored(false);
  }, [profileQuery.data]);

  const accountMutation = useMutation({
    mutationFn: () =>
      api.profile.update({
        displayName: displayName.trim(),
        avatarUrl: avatarUrl.trim() || null,
        dateOfBirth: dateOfBirth.trim() || null,
        age: numberOrNull(age),
        location: location.trim() || null,
        timezone: timezone.trim() || null,
        avgCycleLength: numberOrNull(avgCycleLength),
        notes: notes.trim() || null
      }),
    onSuccess: (payload) => {
      queryClient.setQueryData(["profile"], payload);
      void refreshSession();
      setAccountMessage("Profile updated successfully.");
      setAccountError("");
    },
    onError: (mutationError) => {
      setAccountError((mutationError as Error).message);
      setAccountMessage("");
    }
  });

  const passwordMutation = useMutation({
    mutationFn: () => api.profile.updatePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setPasswordMessage("Password changed successfully.");
      setPasswordError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (mutationError) => {
      setPasswordError((mutationError as Error).message);
      setPasswordMessage("");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.profile.delete(),
    onSuccess: () => {
      navigate("/login", { replace: true });
    },
    onError: (mutationError) => {
      setDeleteError((mutationError as Error).message);
    }
  });

  function resetProfileForm() {
    if (!profileQuery.data) {
      return;
    }
    setDisplayName(profileQuery.data.user.displayName ?? "");
    setAvatarUrl(profileQuery.data.user.avatarUrl ?? "");
    setDateOfBirth(profileQuery.data.profile.dateOfBirth ?? "");
    setAge(profileQuery.data.profile.age?.toString() ?? "");
    setLocation(profileQuery.data.profile.location ?? "");
    setTimezone(profileQuery.data.profile.timezone ?? "");
    setAvgCycleLength(profileQuery.data.profile.avgCycleLength?.toString() ?? "");
    setNotes(profileQuery.data.profile.notes ?? "");
    setAvatarPreviewErrored(false);
    setAccountError("");
    setAccountMessage("");
  }

  function saveProfile() {
    if (!displayName.trim()) {
      setAccountError("Display name is required.");
      setAccountMessage("");
      return;
    }
    if (dateOfBirth && (dateOfBirth < minDateOfBirth || dateOfBirth > maxDateOfBirth)) {
      setAccountError(`Date of birth must be between ${minDateOfBirth} and ${maxDateOfBirth}.`);
      setAccountMessage("");
      return;
    }
    setAccountError("");
    setAccountMessage("");
    accountMutation.mutate();
  }

  function changePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      setPasswordMessage("");
      return;
    }
    setPasswordError("");
    setPasswordMessage("");
    passwordMutation.mutate();
  }

  function deleteProfile() {
    if (deleteConfirmText.trim() !== "DELETE") {
      setDeleteError('Type DELETE to confirm profile deletion.');
      return;
    }
    setDeleteError("");
    deleteMutation.mutate();
  }

  if (profileQuery.isLoading || !profileQuery.data) {
    return <div className="panel">Loading profile...</div>;
  }

  const fallbackAvatar =
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=160&q=80";
  const avatarPreview = avatarUrl.trim() || profileQuery.data.user.avatarUrl || fallbackAvatar;
  const avatarImageSrc = avatarPreviewErrored ? fallbackAvatar : avatarPreview;

  return (
    <div className="profile-layout">
      <section className="panel profile-main">
        <h1>Your Profile</h1>
        <p className="subtitle">Manage account settings, health details, and security.</p>

        <div className="profile-grid">
          <article className="profile-overview-card">
            <h3>Profile Picture</h3>
            <div className="profile-avatar-preview">
              <img src={avatarImageSrc} alt="Profile avatar" onError={() => setAvatarPreviewErrored(true)} />
            </div>
            <label>
              Picture URL
              <input
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>
            <p className="subtitle">Use a direct image URL for your avatar.</p>
            {avatarPreviewErrored && (
              <p className="action-error">
                This link is not a direct image URL. Use an image address ending with .jpg, .png, or .webp.
              </p>
            )}
          </article>

          <article className="profile-form-card">
            <h3>Account Settings</h3>
            <div className="profile-form-grid">
              <label>
                User Name
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
              <label>
                Email (Login Account)
                <input type="email" value={profileQuery.data.user.email} readOnly disabled />
              </label>
            </div>
          </article>

          <article className="profile-form-card">
            <h3>Personal Details</h3>
            <div className="profile-form-grid">
              <label>
                Date of Birth
                <input
                  type="date"
                  min={minDateOfBirth}
                  max={maxDateOfBirth}
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </label>
              <label>
                Age
                <input type="number" min={10} max={60} value={age} onChange={(event) => setAge(event.target.value)} />
              </label>
              <label>
                Location
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="e.g. Kathmandu"
                />
              </label>
              <label>
                Timezone
                <input
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  placeholder="e.g. Asia/Kathmandu"
                />
              </label>
              <label>
                Average Cycle Length (days)
                <input
                  type="number"
                  min={15}
                  max={60}
                  value={avgCycleLength}
                  onChange={(event) => setAvgCycleLength(event.target.value)}
                  placeholder="e.g. 28"
                />
              </label>
              <label>
                Notes
                <textarea
                  rows={4}
                  maxLength={600}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Anything you want to keep in your profile..."
                />
              </label>
            </div>
            <div className="profile-actions">
              <button type="button" className="secondary-btn" onClick={resetProfileForm}>
                Cancel
              </button>
              <button type="button" className="primary-btn" disabled={accountMutation.isPending} onClick={saveProfile}>
                {accountMutation.isPending ? "Saving..." : "Save Profile"}
              </button>
            </div>
            {accountMessage && <p className="action-feedback">{accountMessage}</p>}
            {accountError && <p className="action-error">{accountError}</p>}
          </article>

          <article className="profile-form-card">
            <h3>Change Password</h3>
            <div className="profile-form-grid">
              <label>
                Current Password
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label>
                New Password
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              </label>
              <label>
                Confirm New Password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
            </div>
            <div className="profile-actions">
              <button type="button" className="primary-btn" disabled={passwordMutation.isPending} onClick={changePassword}>
                {passwordMutation.isPending ? "Updating..." : "Update Password"}
              </button>
            </div>
            {passwordMessage && <p className="action-feedback">{passwordMessage}</p>}
            {passwordError && <p className="action-error">{passwordError}</p>}
          </article>

          <article className="profile-danger-card">
            <h3>Delete Profile</h3>
            <p>This permanently removes your account and all linked data.</p>
            <label>
              Type DELETE to confirm
              <input
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder="DELETE"
              />
            </label>
            <button type="button" className="danger-btn" disabled={deleteMutation.isPending} onClick={deleteProfile}>
              {deleteMutation.isPending ? "Deleting..." : "Delete Profile"}
            </button>
            {deleteError && <p className="action-error">{deleteError}</p>}
          </article>
        </div>
      </section>
    </div>
  );
}
