import subprocess
import os
import sys

def run_cmd(args):
    print(f"Executing: {' '.join(args)}")
    # We run without capture_output so that it prints directly in real-time to the user
    res = subprocess.run(args)
    return res.returncode == 0

def main():
    # الانتقال لمجلد الملف الحالي لتجنب مشاكل المسارات
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(current_dir)
    print(f"Current working directory: {current_dir}\n")
    
    print("========================================================")
    print("       جاري تهيئة المستودع ورفع الملفات إلى GitHub")
    print("========================================================")
    
    run_cmd(["git", "init"])
    run_cmd(["git", "add", "."])
    run_cmd(["git", "commit", "-m", "إطلاق استمارة موكب كلية الإمام الكاظم"])
    run_cmd(["git", "branch", "-M", "main"])
    
    # إزالة الرابط القديم إن وجد وإضافة الجديد
    subprocess.run(["git", "remote", "remove", "origin"], capture_output=True)
    run_cmd(["git", "remote", "add", "origin", "https://github.com/HARH-cmd/ikc-procession.git"])
    
    print("\n========================================================")
    print("  جاري الرفع... سيطلب منك النظام تسجيل الدخول إلى GitHub")
    print("========================================================")
    
    success = run_cmd(["git", "push", "-u", "origin", "main"])
    
    if success:
        print("\n========================================================")
        print("        تم الرفع بنجاح! يمكنك إغلاق هذه النافذة.")
        print("========================================================")
    else:
        print("\n========================================================")
        print("     فشل الرفع. تأكد من تسجيل دخولك لـ GitHub وصلاحية الإنترنت.")
        print("========================================================")
        
    input("\nاضغط Enter للخروج...")

if __name__ == "__main__":
    main()
