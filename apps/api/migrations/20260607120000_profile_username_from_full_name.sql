-- Derive profile.username from signup metadata (username or full_name), with fallback.

CREATE OR REPLACE FUNCTION public.sanitize_profile_username(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned TEXT;
BEGIN
  cleaned := NULLIF(trim(raw), '');
  IF cleaned IS NULL THEN
    RETURN NULL;
  END IF;

  cleaned := regexp_replace(cleaned, '[[:cntrl:]]', '', 'g');
  cleaned := NULLIF(trim(cleaned), '');

  IF cleaned IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN left(cleaned, 50);
END;
$$;

CREATE OR REPLACE FUNCTION public.unique_profile_username(base TEXT, user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  sanitized TEXT;
  candidate TEXT;
  suffix INT := 0;
BEGIN
  sanitized := public.sanitize_profile_username(base);

  IF sanitized IS NULL THEN
    RETURN 'user_' || left(user_id::text, 8);
  END IF;

  candidate := sanitized;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    suffix := suffix + 1;
    candidate := left(sanitized, 47) || '_' || suffix::text;
  END LOOP;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (
    NEW.id,
    public.unique_profile_username(
      COALESCE(
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'full_name'
      ),
      NEW.id
    )
  );
  RETURN NEW;
END;
$$;
